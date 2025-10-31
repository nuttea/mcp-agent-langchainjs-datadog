// IMPORTANT: Datadog tracer must be imported first, before any other imports
// Reference: https://docs.datadoghq.com/llm_observability/setup/sdk/nodejs/
// This import initializes the Datadog tracer as a side effect
import './dd-tracer.js';

import express from 'express';
import cors from 'cors';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createAgent, AIMessage, HumanMessage } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { AzureCosmsosDBNoSQLChatMessageHistory } from '@langchain/azure-cosmosdb';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { StreamEvent } from '@langchain/core/dist/tracers/log_stream.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UserDbService } from './user-db-service.js';
import { getAuthenticationUserId, getAzureOpenAiTokenProvider, getCredentials, getInternalUserId } from './auth.js';
import { type AIChatCompletionRequest, type AIChatCompletionDelta } from './models.js';
import { logger } from './logger.js';

const app = express();
const PORT = process.env.PORT || 8080;

const agentSystemPrompt = `## Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.
Be conversational and friendly, like a real person would be, but keep your answers concise and to the point.

## Context
The restaurant is called Contoso Burgers. Contoso Burgets always provides french fries and a fountain drink with every burger order, so there's no need to add them to orders.

## Task
1. Help the user with their request, ask any clarifying questions if needed.
2. ALWAYS generate 3 very brief follow-up questions that the user would likely ask next, as if you were the user.
Enclose the follow-up questions in double angle brackets. Example:
<<Am I allowed to invite friends for a party?>>
<<How can I ask for a refund?>>
<<What If I break something?>>
Make sure the last question ends with ">>", and phrase the questions as if you were the user, not the assistant.

## Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
- Creating or cancelling an order requires the userId, which is provided in the request context. Never ask the user for it or confirm it in your responses.
- Use GFM markdown formatting in your responses, to make your answers easy to read and visually appealing. You can use tables, headings, bullet points, bold text, italics, images, and links where appropriate.
- Only use image links from the menu data, do not make up image URLs.
- When using images in answers, use tables if you are showing multiple images in a list, to make the layout cleaner. Otherwise, try using a single image at the bottom of your answer.

## New Capabilities
- **Weather-Based Recommendations**: Use get_weather to check current weather and suggest menu items that match the conditions (e.g., refreshing items for hot days, comfort food for cold/rainy weather)
- **Entertainment**: Use get_fun_fact to share jokes, food trivia, or interesting facts to keep users engaged while they wait for their order
- **Nutritional Information**: Use get_nutrition_info to provide calorie and nutritional data for burger ingredients when users ask about health/dietary information
- Proactively offer these features when relevant (e.g., "While you wait, would you like to hear a fun burger fact?")
`;

const titleSystemPrompt = `Create a title for this chat session, based on the user question. The title should be less than 32 characters. Do NOT use double-quotes. The title should be concise, descriptive, and catchy. Respond with only the title, no other text.`;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'up', message: 'Agent API is running' });
});

app.get('/api', (_req, res) => {
  res.json({ status: 'up', message: 'Agent API is running' });
});

// Get user info - implements the same logic as me-get Azure Function
// Supports both Azure Easy Auth and anonymous mode for Kubernetes deployment
app.get('/api/me', async (req, res) => {
  try {
    let authenticationUserId = getAuthenticationUserId(req as any);

    // Fall back to anonymous user for Kubernetes/development environments
    if (!authenticationUserId) {
      // Check if we're in development/anonymous mode
      const allowAnonymous = process.env.ALLOW_ANONYMOUS_AUTH === 'true' || !process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;

      if (allowAnonymous) {
        // Use a consistent anonymous user ID or generate one from session
        authenticationUserId = 'anonymous-user';
        console.log('Using anonymous authentication mode');
      } else {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const id = createHash('sha256').update(authenticationUserId).digest('hex').slice(0, 32);
    console.log(`User ID ${id}`);

    const db = await UserDbService.getInstance();
    let user = await db.getUserById(id);
    if (user) {
      console.log(`User exists, returning ID: ${user.id}`);
    } else {
      user = await db.createUser(id);
      console.log(`Created new user with ID: ${id}`);
    }

    res.json({ id: user.id, createdAt: user.createdAt });
  } catch (error) {
    console.error('Error in me-get handler', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Handler for getting chats - implements the same logic as chats-get Azure Function
const getChatsHandler = async (req: express.Request, res: express.Response) => {
  const azureCosmosDbEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
  const { sessionId } = req.params;
  const userId = await getInternalUserId(req as any);

  if (!userId) {
    res.status(400).json({ error: 'Invalid or missing userId in the request' });
    return;
  }

  try {
    if (!azureCosmosDbEndpoint) {
      // Return empty results when Cosmos DB is not configured (for development/K8s)
      console.log('Cosmos DB not configured, returning empty chat history');
      if (sessionId) {
        res.json([]); // Empty messages array
      } else {
        res.json([]); // Empty sessions array
      }
      return;
    }

    const credentials = getCredentials();

    if (sessionId) {
      // Get messages for a specific session
      const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
        sessionId,
        userId,
        credentials,
        containerName: 'history',
        databaseName: 'historyDB',
      });

      const messages = await chatHistory.getMessages();
      const chatMessages = messages.map((message) => ({
        role: message.getType() === 'human' ? 'user' : 'assistant',
        content: message.content,
      }));
      res.json(chatMessages);
      return;
    }

    // Get all sessions (sessionId is undefined)
    const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
      sessionId: undefined as any, // getAllSessions works without a sessionId
      userId,
      credentials,
      containerName: 'history',
      databaseName: 'historyDB',
    });

    const sessions = await chatHistory.getAllSessions();
    const chatSessions = sessions.map((session) => ({
      id: session.id,
      title: session.context?.title,
    }));
    res.json(chatSessions);
  } catch (error: any) {
    console.error(`Error when processing chats-get request: ${error.message}`);
    res.status(404).json({ error: 'Session not found' });
  }
};

// Get chats routes - Express requires separate routes for optional parameters
app.get('/api/chats', getChatsHandler);
app.get('/api/chats/:sessionId', getChatsHandler);

// Helper function to transform the response chunks into a JSON stream
async function* createJsonStream(
  chunks: AsyncIterable<StreamEvent>,
  sessionId: string,
  onComplete: (responseContent: string) => Promise<void>,
) {
  for await (const chunk of chunks) {
    const { data } = chunk;
    let responseChunk: AIChatCompletionDelta | undefined;

    if (chunk.event === 'on_chat_model_end' && data.output?.content.length > 0) {
      // End of our agentic chain
      const content = data?.output.content[0].text ?? data.output.content ?? '';
      await onComplete(content);
    } else if (chunk.event === 'on_chat_model_stream' && data.chunk.content.length > 0) {
      // Streaming response from the LLM
      responseChunk = {
        delta: {
          content: data.chunk.content[0].text ?? data.chunk.content,
          role: 'assistant',
        },
      };
    } else if (chunk.event === 'on_chat_model_end') {
      // Intermediate LLM response (no content)
      responseChunk = {
        delta: {
          context: {
            intermediateSteps: [
              {
                type: 'llm',
                name: chunk.name,
                input: data.input ? JSON.stringify(data.input) : undefined,
                output:
                  data?.output.content.length > 0
                    ? JSON.stringify(data?.output.content)
                    : JSON.stringify(data?.output.tool_calls),
              },
            ],
          },
        },
      };
    } else if (chunk.event === 'on_tool_end') {
      // Tool call completed
      responseChunk = {
        delta: {
          context: {
            intermediateSteps: [
              {
                type: 'tool',
                name: chunk.name,
                input: data?.input?.input ?? undefined,
                output: data?.output.content ?? undefined,
              },
            ],
          },
        },
      };
    } else if (chunk.event === 'on_chat_model_start') {
      // Start of a new LLM call
      responseChunk = {
        delta: {
          context: {
            currentStep: {
              type: 'llm',
              name: chunk.name,
              input: data?.input ?? undefined,
            },
          },
        },
        context: { sessionId },
      };
    } else if (chunk.event === 'on_tool_start') {
      // Start of a new tool call
      responseChunk = {
        delta: {
          context: {
            currentStep: {
              type: 'tool',
              name: chunk.name,
              input: data?.input?.input ? JSON.stringify(data.input?.input) : undefined,
            },
          },
        },
      };
    }

    if (!responseChunk) {
      continue;
    }

    // Format response chunks in Newline delimited JSON
    // see https://github.com/ndjson/ndjson-spec
    yield JSON.stringify(responseChunk) + '\n';
  }
}

// Post chat message (stream response) - supports both Azure OpenAI and regular OpenAI
app.post('/api/chats/stream', async (req, res) => {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const burgerMcpUrl = process.env.BURGER_MCP_URL ?? 'http://localhost:3000/mcp';

  try {
    const requestBody = req.body as AIChatCompletionRequest;
    const { messages, context: chatContext } = requestBody;

    const userId = await getInternalUserId(req as any, requestBody);
    if (!userId) {
      res.status(400).json({ error: 'Invalid or missing userId in the request' });
      return;
    }

    if (messages?.length === 0 || !messages.at(-1)?.content) {
      res.status(400).json({ error: 'Invalid or missing messages in the request body' });
      return;
    }

    const sessionId = ((chatContext as any)?.sessionId as string) || randomUUID();
    console.log(`userId: ${userId}, sessionId: ${sessionId}`);

    // Check if we have either Azure OpenAI or regular OpenAI configured
    if (!azureOpenAiEndpoint && !openaiApiKey) {
      const errorMessage = 'Missing required environment variables: AZURE_OPENAI_API_ENDPOINT or OPENAI_API_KEY';
      console.error(errorMessage);
      res.status(500).json({ error: errorMessage });
      return;
    }

    if (!burgerMcpUrl) {
      const errorMessage = 'Missing required environment variable: BURGER_MCP_URL';
      console.error(errorMessage);
      res.status(500).json({ error: errorMessage });
      return;
    }

    // Create ChatOpenAI model - supports both Azure and regular OpenAI
    let model: ChatOpenAI;
    if (azureOpenAiEndpoint) {
      // Use Azure OpenAI
      console.log('Using Azure OpenAI');
      model = new ChatOpenAI({
        configuration: {
          baseURL: azureOpenAiEndpoint,
          async fetch(url, init = {}) {
            const token = await getAzureOpenAiTokenProvider()();
            const headers = new Headers(init.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return fetch(url, { ...init, headers });
          },
        },
        modelName: process.env.AZURE_OPENAI_MODEL ?? 'gpt-4o-mini',
        streaming: true,
        useResponsesApi: true,
        apiKey: 'not_used',
      });
    } else {
      // Use regular OpenAI
      console.log('Using regular OpenAI (api.openai.com)');
      model = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        apiKey: openaiApiKey,
        streaming: true,
      });
    }
    // Initialize chat history if Cosmos DB is configured
    const azureCosmosDbEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
    let chatHistory: AzureCosmsosDBNoSQLChatMessageHistory | null = null;
    let previousMessages: any[] = [];

    if (azureCosmosDbEndpoint) {
      chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
        sessionId,
        userId,
        credentials: getCredentials(),
        containerName: 'history',
        databaseName: 'historyDB',
      });
      previousMessages = await chatHistory.getMessages();
      console.log(`Previous messages in history: ${previousMessages.length}`);
    } else {
      console.log('Cosmos DB not configured, chat history will not be persisted');
    }

    const client = new Client({
      name: 'burger-mcp-client',
      version: '1.0.0',
    });
    console.log(`Connecting to Burger MCP server at ${burgerMcpUrl}`);
    const transport = new StreamableHTTPClientTransport(new URL(burgerMcpUrl));
    await client.connect(transport);

    const tools = await loadMcpTools('burger', client);
    console.log(`Loaded ${tools.length} tools from Burger MCP server`);

    const agent = createAgent({
      model,
      tools,
      systemPrompt: agentSystemPrompt,
    });

    const question = messages.at(-1)!.content;

    // Start the agent and stream the response events
    const responseStream = agent.streamEvents(
      {
        messages: [['human', `userId: ${userId}`], ...previousMessages, ['human', question]],
      },
      {
        configurable: { sessionId },
        version: 'v2',
      },
    );

    // Create a short title for this chat session (only if chat history is enabled)
    const generateSessionTitle = async () => {
      if (chatHistory) {
        const { title } = await chatHistory.getContext();
        if (!title) {
          const response = await model.invoke([
            ['system', titleSystemPrompt],
            ['human', question],
          ]);
          console.log(`Title for session: ${response.text}`);
          chatHistory.setContext({ title: response.text });
        }
      }
    };

    // We don't await this yet, to allow parallel execution.
    // We'll await it later, after the response is fully sent.
    const sessionTitlePromise = generateSessionTitle();

    // Update chat history when the response is complete
    const onResponseComplete = async (content: string) => {
      try {
        if (content && chatHistory) {
          // When no content is generated, do not update the history as it's likely an error
          await chatHistory.addMessage(new HumanMessage(question));
          await chatHistory.addMessage(new AIMessage(content));
          console.log('Chat history updated successfully');

          // Ensure the session title has finished generating
          await sessionTitlePromise;
        }

        // Close MCP client connection
        await client.close();
      } catch (error) {
        console.error('Error after response completion:', error);
      }
    };

    const jsonStream = Readable.from(createJsonStream(responseStream, sessionId, onResponseComplete));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Transfer-Encoding', 'chunked');
    jsonStream.pipe(res);
  } catch (error: any) {
    logger.error({ err: error }, 'Error when processing chat-post request');
    res.status(500).json({ error: 'Internal server error while processing the request' });
  }
});

// Delete chat session - implements the same logic as chats-delete Azure Function
app.delete('/api/chats/:sessionId', async (req, res) => {
  const azureCosmosDbEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
  const { sessionId } = req.params;
  const userId = await getInternalUserId(req as any);

  if (!userId) {
    res.status(400).json({ error: 'Invalid or missing userId in the request' });
    return;
  }

  if (!sessionId) {
    res.status(400).json({ error: 'Invalid or missing sessionId in the request' });
    return;
  }

  try {
    if (!azureCosmosDbEndpoint) {
      const errorMessage = 'Missing required environment variable: AZURE_COSMOSDB_NOSQL_ENDPOINT';
      logger.error({ userId, sessionId }, errorMessage);
      res.status(500).json({ error: errorMessage });
      return;
    }

    const credentials = getCredentials();
    const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
      sessionId,
      userId,
      credentials,
      containerName: 'history',
      databaseName: 'historyDB',
    });

    await chatHistory.clear();
    res.status(204).send();
  } catch (error: any) {
    logger.error({ err: error, userId, sessionId }, 'Error when processing chats-delete request');
    res.status(404).json({ error: 'Session not found' });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Agent API server listening');
});

export default app;
