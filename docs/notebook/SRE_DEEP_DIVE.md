## SRE Deep Dive

### Jirayut Nimsaeng (Dear)

CEO & Founder, Opsta (Thailand) Co.,Ltd.

DevSecOps Meetup:
Reliability Unleashed: SRE at Scale

TechTalkThai Meetup Space
6 November 2025

-----

## \#whoami

Jirayut Nimsaeng (Dear)

Jirayut has been involved in DevSecOps, Container, Cloud Technology and Open Source for over 10 years. He has experienced and succeeded in transforming several companies to deliver greater values and be more agile.

  * Founder and CEO of Opsta (Thailand) Co.,Ltd.
  * Cloud/DevSecOps Transformation Consultant and Solution Architecture
  * First Certified Kubernetes Administrator (CKA) and Certified Kubernetes Security Specialist (CKS) in Thailand
  * First Thai Google Cloud Developer Expert (GDE) in Thailand
  * Google Cloud Certified - Professional Cloud Architect and Associate Cloud Engineer

-----

DevSecOps Tools
Modern Infrastructure
Observability
CI/CD
Monitoring

Application Modernization Platform

-----

## Monitoring vs Observability vs SRE

### Monitoring

  * Gathers information passively
  * Focuses on collecting data
  * What happened?
  * How did we fix it last time?

### Observability

  * Tries to understand information
  * Focuses on giving data context
  * Why did it happen?
  * How we prevent it in the future?

### SRE

  * Engineers for reliability
  * Balances reliability/features
  * What's our reliability goal?
  * How to automate the fix?

-----

## Site Reliability Engineering (SRE)

### DevSecOps

A set of principles & culture guidelines that helps to breakdown the silos between development and operations / networking / security

### SRE

A set of practices with an emphasis of strong engineering capabilities that implement the DevSecOps practices, and sets a job role + team

**SRE Implements DevSecOps**
Site Reliability Engineers spend less than 50% of their time performing operational work to allow them to spend more time on improving infrastructure and task automation
SRE is good for product-based

### SRE Team Capacity

> The most important feature of any system is its reliability

-----

## Design Reliability

Customer “HTTP GET / …”
0 ms 200 ms 300 ms “Ugh”

Indicator

[Image of target icon]

Objective

Agreement

-----

## SRE Terminology

### Service Levels

Product Management with SREs define service levels for the systems as part of product design

### Service Level Indicator (SLI)

  * Quantitative measure of an attribute of the service, such as throughput, latency
  * A directly measurable & observable by the users – not an internal metric (response time vs. CPU utilization)
  * Could be a way to represent the user's experience

### Service Level Objective (SLO)

  * A threshold beyond which an improvement of the service is required
  * The point at which the users may consider opening up support ticket, the "pain threshold", e.g., YouTube buffering
  * Driven by business requirements, not just current performance

### Service Level Agreement (SLA)

  * A business contract the service provider + the customer • Loss of service could be related to loss of business
  * Typically, an SLA breach would mean some form of compensation to the client

-----

## Service Levels Example

Product Management with SREs define service levels for the systems as part of product design

**Service Level Indicator (SLI)**
The latency of successful HTTP responses (HTTP 200)

**Service Level Objective (SLO)**
The latency of 95% of the responses must be less than 200ms

**Service Level Agreement (SLA)**
Customer compensated if the 95th percentile latency exceeds 300ms

-----

## Combine Service Levels

Customer “HTTP GET / …”
0 ms 200 ms 300 ms “Ugh”

Indicator (SLI)

Objective (SLO)

Agreement (SLA)

> 100% is the wrong reliability target for basically everything

-----

## Error Budget

[https://availability.sre.xyz](https://availability.sre.xyz)

  * Error Budgets tend to bring balance between SRE and application development by mitigating risks.
  * An Error Budget is unaffected until the system availability will fall within the SLO.
  * The Error Budget can always be adjusted by managing the SLOs or enhancing the IT operability.
  * The ultimate goal remains application reliability and scalability.
  * Releasing new features
  * Expected system changes
  * Inevitable failure in hardware,networks, etc.
  * Planned downtime
  * Risky experiments

| Availability level | Downtime per year | Downtime per quarter | Downtime per month | Downtime per week | Downtime per day | Downtime per hour |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 90% | 36.52 days | 9.13 days | 3.04 days | 16.80 hours | 2.40 hours | 6.00 minutes |
| 95% | 18.26 days | 4.57 days | 1.52 days | 8.40 hours | 1.20 hours | 3.00 minutes |
| 99% | 3.65 days | 21.91 hours | 7.30 hours | 1.68 hours | 14.40 minutes | 36.00 seconds |
| 99.5% | 1.83 days | 10.96 hours | 3.65 hours | 50.40 minutes | 7.20 minutes | 18.00 seconds |
| 99.9% | 8.77 hours | 2.19 hours | 43.83 minutes | 10.08 minutes | 1.44 minutes | 3.60 seconds |
| 99.95% | 4.38 hours | 1.10 hours | 21.91 minutes | 5.04 minutes | 43.20 seconds | 1.80 seconds |
| 99.99% | 52.59 minutes | 13.15 minutes | 4.38 minutes | 1.01 minutes | 8.64 seconds | 0.36 seconds |
| 99.999% | 5.26 minutes | 1.31 minutes | 26.30 seconds | 6.05 seconds | 0.86 seconds | 0.04 seconds |

\<p align="center"\>Calculations are based on the average Gregorian year: 365.2425 days\</p\>

-----

## Designing SLI & SLO

### SLI

SLI is a quantifiable measure of service reliability. While many numbers can function as an SLI, we generally recommend treating the SLI as the ratio of two numbers: the number of good events divided by the total number of events

  * Number of successful HTTP requests / total HTTP requests (success rate)
  * Number of gRPC calls that completed successfully in \< 100 ms / total gRPC requests
  * Number of home page requests that loaded in \< 100 ms / total home page requests

**SLI :** (good events / valid events) × 100%

**SLI ?? :** (buy / visitors) × 100%

-----

### Game System

  * Web Server

  * API Server

  * Load Balancer

  * Leaderboards

  * User Profiles

  * Game Servers

  * Leaderboard Generation

  * Loading a Profile Page

  * Web Server

  * API Server

  * Load Balancer

  * Leaderboards

  * User Profiles

  * Game Servers

  * Leaderboard Generation

-----

The profile page should load successfully
The profile page should load quickly

**Availability**
*How do we define success?*
*Where is the success / failure recorded?*

**Latency**
*How do we define quickly?*
*When does the timer start / stop?*

-----

The profile page should load successfully
**Availability:** The proportion of valid requests served successfully.
*How do we define success?*
*Where is the success / failure recorded?*

The profile page should load quickly
**Latency:** The proportion of valid requests served faster than a threshold.
*How do we define quickly?*
*When does the timer start / stop?*

-----

The profile page should load successfully
**Availability:** The proportion of valid requests served successfully.
*How do we define success?*
*Where is the success / failure recorded?*

The profile page should load quickly
**Latency:** The proportion of valid requests served faster than a threshold.
*How do we define quickly?*
*When does the timer start / stop?*

-----

The profile page should load successfully
**Availability:** The proportion of HTTP GET requests for /profile/{user} or /profile/{user}/avatar served successfully.
*How do we define success?*
*Where is the success / failure recorded?*

The profile page should load quickly
**Latency:** The proportion of HTTP GET requests for /profile/{user} served faster than a threshold.
*How do we define quickly?*
*When does the timer start / stop?*

-----

The profile page should load successfully
**Availability:** The proportion of HTTP GET requests for /profile/{user} or /profile/{user}/avatar served successfully.
*How do we define success?*
*Where is the success / failure recorded?*

The profile page should load quickly
**Latency:** The proportion of HTTP GET requests for /profile/{user} served faster than a threshold.
*How do we define quickly?*
*When does the timer start / stop?*

-----

The profile page should load successfully
**Availability:** The proportion of HTTP GET requests for /profile/{user} or /profile/{user}/avatar that have 2XX, 3XX or 4XX (excl. 429) status.
*How do we define success?*
*Where is the success / failure recorded?*

The profile page should load quickly
**Latency:** The proportion of HTTP GET requests for /profile/{user} served within X ms.
*How do we define quickly?*
*When does the timer start / stop?*

-----

The profile page should load successfully
**Availability:** The proportion of HTTP GET requests for /profile/{user} or /profile/{user}/avatar that have 2XX, 3XX or 4XX (excl. 429) status measured at the load balancer.
*How do we define success?*
*Where is the success / failure recorded?*

The profile page should load quickly
**Latency:** The proportion of HTTP GET requests for /profile/{user} that send their entire response within X ms measured at the load balancer.
*How do we define quickly?*
*When does the timer start / stop?*

-----

## SLO

| Service | SLO Type | Objective |
| :--- | :--- | :--- |
| Web: User Profile | Availability | 99.95% successful in previous 28d |
| Web: User Profile | Latency | 90% of requests \< 500ms in previous 28d |
| ... | ... | |

Your objectives should have both a target and a measurement window

-----

## SLI Types

| SLI Category | The SLI | The Simple Question It Answers | Example from Your Game |
| :--- | :--- | :--- | :--- |
| Request / Response | Availability | "When a player clicks, does the feature actually work, or do they get an error?" | Loading the User Profile Page |
| Request / Response | Latency | "How fast does the feature feel? Is it instant (happy) or slow (frustrated)?" | The "lag" on the Live Game Server |
| Request / Response | Quality | "One part broke. Did the feature still load in a 'good enough' way, or did it crash entirely?" | Profile Page loading without the 'Friends List' |
| Data Processing | Coverage | "Did our factory process all the data it was supposed to?" | Leaderboard Job processing all new scores |
| Data Processing | Correctness | "Is the math right? Is the final data accurate?" | Leaderboard Job showing the correct \#1 player |
| Data Processing | Freshness | "How new is the data? Is it from right now, or from yesterday?" | Leaderboard showing a score from 30 minutes ago |
| Data Processing | Throughput | "How fast is the factory working? How many items can it process per minute?" | Leaderboard Job processing 1,000 scores per minute |
| Storage | Throughput | "How many players can save data at the same time without it crashing?" | 10,000 players saving loot after a world boss |
| Storage | Latency | "How fast is data saved? When a player gets an item, is it saved instantly?" | Saving a new rare item to the Inventory Database |

-----

## Sample SLOs (From AI)

| Service | SLO Type | Objective (The Goal) |
| :--- | :--- | :--- |
| Web: User Profile | Availability | 99.9% of profile page requests will load successfully. (Allows for \~43 minutes of downtime per month) |
| Web: User Profile | Latency | 95% of profile pages will finish loading in under 1.5 seconds. (The other 5% can be slower, but we'll work to fix them) |
| Web: User Profile | Quality | 99.9% of profile pages will load without degraded quality. (e.g., the Friends List must not be broken) |
| API: Login Service | Availability | 99.95% of all login attempts will be successful. (This is more critical, so we allow less downtime) |
| Game Server: Live Match | Latency (Lag) | 99% of all player actions (like firing) will be registered by the server in under 100 milliseconds. |
| Batch: Leaderboard Job | Coverage | 99.999% of all new scores will be successfully included in the processing job. |
| Batch: Leaderboard Job | Correctness | 100% of the leaderboard calculations must be mathematically correct. |
| Batch: Leaderboard Job | Freshness | All new scores must be reflected on the public leaderboard no more than 30 minutes after a match ends. |
| Batch: Leaderboard Job | Throughput | The job must be able to process at least 1,000 new scores per minute to keep up with demand. |
| Storage: Inventory DB | Throughput | The database must support 20,000 players saving an item at the same time (e.g., after a world boss) without errors. |
| Storage: Inventory DB | Latency | 99.5% of all inventory "save" operations will be confirmed as complete in under 250 milliseconds. |

SLOs only apply to data that is 28 days or fresher.

-----

## SLO-Based Alerting

  * A tape backup system should create a backup of new incoming data within 30 minutes 95% of the time.
  * A batch job processing important orders should run successfully at least once a day.
  * A web service should return errors for less than 1% of its requests, as measured over a 5-minute window.
  * A web service should handle 99% of its requests within 150ms, as measured over a 5-minute window.

## SLO Dashboard

-----

## Post Mortem

### What is Post Mortem?

  * Post Mortem is a blameless document that analyzes an incident after it has been resolved.
  * It is not a "blame report" or a list of human errors. It focuses on process and system failures.
  * Its primary goal is to understand the systemic causes (the "why") behind the failure.
  * It details the impact, the actions taken, the root causes, and the action items to prevent a recurrence.

### Key Components of a Post Mortem

  * **Header & Status:** Title, Date, Authors, and current status (e.g., "In Progress", "Complete"). Clearly identifies the incident and authors.
  * **Summary & Impact:** A brief, one-paragraph summary of the incident and a clear, user-focused description of the impact (e.g., SLO breached, error rates).
  * **Root Cause & Trigger:** A blameless analysis of the direct cause (the trigger) and the underlying systemic reasons why it was able to happen.
  * **Detection & Resolution:** How the incident was detected (e.g., monitoring alert, customer report) and the steps taken to mitigate and fully resolve the issue.
  * **Action Items:** The most critical part. A list of specific, measurable, and owned tasks to fix the root cause and prevent reoccurrence.
  * **Lessons Learned:** A blameless summary of what went well (e.g., quick detection), what went poorly (e.g., slow escalation), and key takeaways.
  * **Timeline:** A detailed, timestamped log of key events, from the first detection to the final resolution, to provide complete context.

### Key Components of a Post Mortem

[https://gist.github.com/mlafeldt/6e02ea0caeebef1205b47f31c2647966](https://gist.github.com/mlafeldt/6e02ea0caeebef1205b47f31c2647966)

### Why Post Mortem?

  * **Reduces Future Incidents:** It's the \#1 tool to learn from failures and build a more reliable system.
  * **Builds Psychological Safety:** The "blameless" aspect encourages honesty and empowers engineers to reveal flaws without fear.
  * **Drives Real Improvement:** It creates a list of concrete, tracked Action Items that directly improve reliability.
  * **Shares Knowledge:** It spreads lessons from one team to the entire organization, preventing others from making the same mistake.

-----

## Wrap up

### Steps of SRE

Your first attempt at an SLI and SLO doesn’t have to be correct.
The most important goal is to get something in place and measured, and to set up a feedback loop so you can improve.
[https://www.cncf.io/blog/2020/07/17/site-reliability-engineering-sre-101-with-devops-vs-sre/](https://www.cncf.io/blog/2020/07/17/site-reliability-engineering-sre-101-with-devops-vs-sre/)

  * **Step 1: Monitor** - keep a tab on key functionalities w.r.t to reliability and scalability
  * **Step 2: Visualize** - represent finding graphically and identify bottlenecks
  * **Step 3: Remediate** - find solutions and execute effectively
  * **Step 4: Improve** - be vigilant and uphold the principle of zero downtime

### SRE Team Capacity

-----

## Thank You

### Contact Us

  * fb.me/DearJirayut
  * [www.linkedin.com/in/jirayut/](https://www.linkedin.com/in/jirayut/)
  * jirayut@opsta.co.th
  * www.opsta.co.th

Jirayut Nimsaeng (Dear)
Founder & CEO of Opsta
[https://www.opsta.co.th](https://www.opsta.co.th)

[https://www.facebook.com/groups/devsecopsthailand](https://www.facebook.com/groups/devsecopsthailand)

DevSecOps Community Thailand

-----

## Apdex Score

Apdex (Application Performance Index) is an open standard developed by an alliance of companies for measuring performance of software applications in computing.
Its purpose is to convert measurements into insights about user satisfaction, by specifying a uniform way to analyze and report on the degree to which measured performance meets user expectations.

### Apdex Score Calculation

**Formula:**
Apdex = (Satisfied\_count + (Tolerating\_count / 2)) / Total\_samples

**Score Ranges:**
| Score | Rating |
| :--- | :--- |
| 1.00 - 0.94 | EXCELLENT |
| 0.93 - 0.85 | GOOD |
| 0.84 - 0.70 | FAIR |
| 0.69 - 0.50 | POOR |
| 0.49 - 0.00 | UNACCEPTABLE |

### Sample Apdex Score Calculation

  * **Satisfying (0-2s):** 150
  * **Tolerating (2s-5s):** 30
  * **Frustrating (\>5s):** 20
  * **Total Samples:** 200

**Calculation:**
Apdex = (150 + (30 / 2)) / 200 = 0.825

This score (0.825) falls into the **FAIR** range (0.84 - 0.70).
