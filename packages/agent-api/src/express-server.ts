// Load environment variables from .env file (for local development)
import 'dotenv/config';

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
import { loadMcpTools } from '@langchain/mcp-adapters';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UserDbService } from './user-db-service.js';
import { PostgresChatMessageHistory } from './postgres-chat-history.js';
import { getAuthenticationUserId, getAzureOpenAiTokenProvider, getInternalUserId } from './auth.js';
import { type AIChatCompletionRequest, type AIChatCompletionDelta } from './models.js';
import { logger } from './logger.js';
import { extractIAPUser, isIAPEnabled, getIAPUser } from './middleware/iap-auth.js';
import { verifyGoogleToken, createSessionToken, isGoogleAuthEnabled } from './auth/google-oauth.js';
import tracer from 'dd-trace';
import { llmobs } from './dd-tracer.js';

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

// IAP Authentication Middleware (conditionally enabled)
// Extracts IAP user headers and attaches to request + Datadog traces
if (isIAPEnabled()) {
  app.use(extractIAPUser);
  logger.info('IAP authentication enabled - extracting user headers');
} else {
  logger.info('IAP authentication disabled - running in anonymous mode');
}

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'up', message: 'Agent API is running' });
});

app.get('/api', (_req, res) => {
  res.json({ status: 'up', message: 'Agent API is running' });
});

// Simulation endpoints for testing Datadog APM
// These endpoints help test error tracking and latency monitoring in Datadog

// Simulate an error (for testing Datadog APM error tracking)
app.get('/api/simulate/error', (_req, _res) => {
  logger.error('Simulated error endpoint called - this is intentional for APM testing');

  // Throw an error that will be caught by Datadog APM
  const error = new Error('Simulated error for Datadog APM testing');
  (error as any).code = 'SIMULATED_ERROR';
  (error as any).statusCode = 500;

  // This will show up in Datadog APM as an error on the express.request operation
  throw error;
});

// Simulate high latency (for testing Datadog APM latency monitoring)
app.get('/api/simulate/latency', async (req, res) => {
  const delayQuery = Array.isArray(req.query.delay) ? req.query.delay[0] : req.query.delay;
  const delay = parseInt(delayQuery as string, 10) || 2000; // Default 2 seconds
  const maxDelay = 10000; // Max 10 seconds for safety
  const actualDelay = Math.min(delay, maxDelay);

  logger.info(`Simulating ${actualDelay}ms latency for APM testing`);

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, actualDelay));

  res.json({
    status: 'success',
    message: `Simulated ${actualDelay}ms latency`,
    timestamp: new Date().toISOString()
  });
});

// Combined simulation: both error and latency
app.get('/api/simulate/slow-error', async (req, _res) => {
  const delayQuery = Array.isArray(req.query.delay) ? req.query.delay[0] : req.query.delay;
  const delay = parseInt(delayQuery as string, 10) || 1500;
  const maxDelay = 10000;
  const actualDelay = Math.min(delay, maxDelay);

  logger.warn(`Simulating ${actualDelay}ms latency followed by error`);

  // Simulate slow processing
  await new Promise(resolve => setTimeout(resolve, actualDelay));

  // Then throw an error
  const error = new Error('Simulated slow error for Datadog APM testing');
  (error as any).code = 'SIMULATED_SLOW_ERROR';
  (error as any).statusCode = 500;

  throw error;
});

// Get user info - implements the same logic as me-get Azure Function
// Supports Google OAuth (JWT), Azure Easy Auth, IAP, and anonymous mode
app.get('/api/me', async (req, res) => {
  try {
    let authenticationUserId = getAuthenticationUserId(req as any);

    // Check for Google OAuth JWT token first
    if (!authenticationUserId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { verifySessionToken } = await import('./auth/google-oauth.js');
        const user = verifySessionToken(token);
        if (user) {
          authenticationUserId = user.email;
          logger.info(`Using Google OAuth authenticated user: ${user.email}`);
        }
      }
    }

    // Check for IAP authentication
    if (!authenticationUserId) {
      const iapUser = getIAPUser(req);
      if (iapUser) {
        // Use IAP email as the authentication user ID
        authenticationUserId = iapUser.email;
        logger.info(`Using IAP authenticated user: ${iapUser.email}`);
      }
    }

    // Fall back to anonymous user for Kubernetes/development environments
    if (!authenticationUserId) {
      // Check if we're in development/anonymous mode
      const allowAnonymous = process.env.ALLOW_ANONYMOUS_AUTH === 'true' || !process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;

      if (allowAnonymous) {
        // Use a consistent anonymous user ID or generate one from session
        authenticationUserId = 'anonymous-user';
        logger.info('Using anonymous authentication mode');
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
    logger.error({ err: error }, 'Error in me-get handler');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Google OAuth authentication endpoint
// Cloud-agnostic authentication that works with any infrastructure
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'Missing credential in request body' });
      return;
    }

    if (!isGoogleAuthEnabled()) {
      res.status(503).json({ error: 'Google authentication is not enabled' });
      return;
    }

    // Verify Google ID token
    const user = await verifyGoogleToken(credential);
    logger.info(`Google OAuth login: ${user.email}`);

    // Create session token (JWT)
    const sessionToken = createSessionToken(user);

    // Create or get user in database using email as authentication ID
    const userId = createHash('sha256').update(user.email).digest('hex').slice(0, 32);
    const db = await UserDbService.getInstance();
    let dbUser = await db.getUserById(userId);

    if (!dbUser) {
      dbUser = await db.createUser(userId);
      logger.info(`Created new user from Google OAuth: ${user.email} (ID: ${userId})`);
    } else {
      logger.info(`Existing user logged in: ${user.email} (ID: ${userId})`);
    }

    // Add Datadog APM tags for authentication event
    const span = tracer.scope().active();
    if (span) {
      span.setTag('usr.email', user.email);
      span.setTag('usr.id', user.userId);
      span.setTag('usr.name', user.name);
      span.setTag('auth.provider', 'google-oauth');
      span.setTag('auth.event', 'login');
    }

    // Return session token and user info
    res.json({
      token: sessionToken,
      user: {
        userId: dbUser.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error: any) {
    logger.error('Google OAuth authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message || 'Invalid Google token',
    });
  }
});

// Handler for getting chats - implements the same logic as chats-get Azure Function
const getChatsHandler = async (req: express.Request, res: express.Response) => {
  const { sessionId } = req.params;
  const userId = await getInternalUserId(req as any);

  if (!userId) {
    res.status(400).json({ error: 'Invalid or missing userId in the request' });
    return;
  }

  try {
    const userDb = await UserDbService.getInstance();
    const pool = userDb.getPool();

    if (!pool) {
      // Return empty results when PostgreSQL is not configured (for development)
      console.log('PostgreSQL not configured, returning empty chat history');
      if (sessionId) {
        res.json([]); // Empty messages array
      } else {
        res.json([]); // Empty sessions array
      }
      return;
    }

    if (sessionId) {
      // Get messages for a specific session
      const chatHistory = new PostgresChatMessageHistory({
        sessionId,
        userId,
        pool,
      });

      const messages = await chatHistory.getMessages();
      const chatMessages = messages.map((message: any) => ({
        role: message._getType() === 'human' ? 'user' : 'assistant',
        content: message.content,
      }));
      res.json(chatMessages);
      return;
    }

    // Get all sessions (sessionId is undefined)
    const chatHistory = new PostgresChatMessageHistory({
      sessionId: '', // Not needed for getAllSessions
      userId,
      pool,
    });

    const sessions = await chatHistory.getAllSessions();
    const chatSessions = sessions.map((session: any) => ({
      id: session.id,
      title: session.title,
    }));
    res.json(chatSessions);
  } catch (error: any) {
    logger.error({ err: error }, 'Error when processing chats-get request');
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
      logger.error(errorMessage);
      res.status(500).json({ error: errorMessage });
      return;
    }

    if (!burgerMcpUrl) {
      const errorMessage = 'Missing required environment variable: BURGER_MCP_URL';
      logger.error(errorMessage);
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
    // Initialize chat history if PostgreSQL is configured
    const userDb = await UserDbService.getInstance();
    const pool = userDb.getPool();
    let chatHistory: PostgresChatMessageHistory | null = null;
    let previousMessages: any[] = [];
    let mcpSessionId: string | undefined;

    if (pool) {
      chatHistory = new PostgresChatMessageHistory({
        sessionId,
        userId,
        pool,
      });
      previousMessages = await chatHistory.getMessages();
      console.log(`Previous messages in history: ${previousMessages.length}`);

      // Try to get existing MCP session ID from context
      const context = await chatHistory.getContext();
      mcpSessionId = context.mcpSessionId;
      if (mcpSessionId) {
        console.log(`Using existing MCP session ID: ${mcpSessionId}`);
      } else {
        console.log('No existing MCP session ID found, will create new session');
      }
    } else {
      console.log('PostgreSQL not configured, chat history will not be persisted');
    }

    const client = new Client({
      name: 'burger-mcp-client',
      version: '1.0.0',
    });
    console.log(`Connecting to Burger MCP server at ${burgerMcpUrl}`);

    // Create transport with mcp-session-id header if we have an existing session
    const transportUrl = new URL(burgerMcpUrl);
    const transportOptions: { sessionId?: string } = {};

    // Pass the session ID if we have one stored
    if (mcpSessionId) {
      transportOptions.sessionId = mcpSessionId;
    }

    const transport = new StreamableHTTPClientTransport(transportUrl, transportOptions);
    await client.connect(transport);

    // Store the MCP session ID for future requests (if we have chat history and it's a new session)
    if (chatHistory && !mcpSessionId) {
      // For new sessions, burger-mcp creates the session ID during connection
      // Get the session ID from the transport after successful connection
      const newMcpSessionId = transport.sessionId;
      if (newMcpSessionId) {
        console.log(`New MCP session created with ID: ${newMcpSessionId}, storing in database`);
        // Merge with existing context to avoid overwriting title
        await chatHistory.setContext({ ...(await chatHistory.getContext()), mcpSessionId: newMcpSessionId });
      } else {
        console.log('Warning: Could not retrieve MCP session ID from transport');
      }
    }

    // Load MCP tools with LLM Observability tracking
    const tools = await llmobs.trace(
      {
        kind: 'tool',
        name: 'load_mcp_tools',
        sessionId,
      },
      async (span) => {
        const loadedTools = await loadMcpTools('burger', client);
        logger.info({ toolCount: loadedTools.length, sessionId }, 'Loaded tools from Burger MCP server');

        // Annotate with tool metadata
        llmobs.annotate({
          outputData: {
            toolCount: loadedTools.length,
            toolNames: loadedTools.map(t => t.name)
          },
          metadata: {
            mcpServer: 'burger-mcp',
            mcpUrl: burgerMcpUrl,
            mcpSessionId,
          }
        });

        return loadedTools;
      }
    );

    const agent = createAgent({
      model,
      tools,
      systemPrompt: agentSystemPrompt,
    });

    const question = messages.at(-1)!.content;

    // Start the agent with LLM Observability workflow tracking
    const responseStream = await llmobs.trace(
      {
        kind: 'workflow',
        name: 'burger_assistant_agent',
        sessionId,
      },
      async (span) => {
        // Annotate input
        llmobs.annotate({
          inputData: {
            question: question.slice(0, 500), // First 500 chars
            userId
          },
          metadata: {
            previousMessagesCount: previousMessages.length,
            mcpSessionId: mcpSessionId || 'new',
            model: azureOpenAiEndpoint ? process.env.AZURE_OPENAI_MODEL : process.env.OPENAI_MODEL,
          }
        });

        // Stream the agent response events
        return agent.streamEvents(
          {
            messages: [['human', `userId: ${userId}`], ...previousMessages, ['human', question]],
          },
          {
            configurable: { sessionId },
            version: 'v2',
          },
        );
      }
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
          logger.debug({ title: response.text, sessionId }, 'Generated session title');
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
        // Annotate LLM Observability with the final output
        if (content) {
          llmobs.annotate({
            outputData: {
              response: content.slice(0, 1000), // First 1000 chars
              responseLength: content.length
            },
            metadata: {
              sessionUpdated: !!chatHistory
            }
          });
        }

        if (content && chatHistory) {
          // When no content is generated, do not update the history as it's likely an error
          await chatHistory.addMessage(new HumanMessage(question));
          await chatHistory.addMessage(new AIMessage(content));
          logger.info({ sessionId }, 'Chat history updated successfully');

          // Ensure the session title has finished generating
          await sessionTitlePromise;
        }

        // Close MCP client connection
        await client.close();
      } catch (error) {
        logger.error({ err: error }, 'Error after response completion');
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
    const userDb = await UserDbService.getInstance();
    const pool = userDb.getPool();

    if (!pool) {
      const errorMessage = 'PostgreSQL not configured';
      logger.error({ userId, sessionId }, errorMessage);
      res.status(500).json({ error: errorMessage });
      return;
    }

    const chatHistory = new PostgresChatMessageHistory({
      sessionId,
      userId,
      pool,
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
