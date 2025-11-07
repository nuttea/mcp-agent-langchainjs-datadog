---
title: 'SLO Specification: [Service Name] - Template'
author: Nuttee Jirattivongvibul
modified: 2025-11-06T09:13:10.627Z
tags: []
metadata: {}
time:
  live_span: 1h
template_variables: []
---


| **Property**| **Details**|
|-|-|
| **Status**| **Draft / Review / Accepted / Closed**|
| **Author**| Name|
| **Team**| Name|
| **Last updated**| hh:mm UTC MM/dd/yyyy|
| **Reviewers**| Name|

# Service Description

_Provide some information on the service you're creating SLOs for. What is its purpose? What are its upstream and downstream dependencies? How critical is the service?_

# SLO 1: \[Name\]

**User Journey:** _Users are able to successfully add an item to their shopping cart_

**SLI Category:** _Availability_

**SLI:** _The proportion of successful (2xx) requests, measured with APM trace metrics_

**SLO:** _99.9% over 30 days_

**Alert Policy:**

* _Page when burn rate exceeds 14.4x over a 1 hour long window and 5 min short window_

* _Create a case/ticket when burn rate exceeds 1x over a 3 day long window and 6 hour short window_

# SLO 2: \[Name\]

_Copy the template above for each SLO you're creating_

# Error Budget Policy

**SLO Miss Policy:** _What should be done when the SLOs for this service are out of compliance?_

**Outage Policy:** _What should be done in the case of a major incident?_

# Open Questions

_Note relevant questions here_

# Appendix

[_Link_](https://app.datadoghq.com/)_ relevant documents or references_