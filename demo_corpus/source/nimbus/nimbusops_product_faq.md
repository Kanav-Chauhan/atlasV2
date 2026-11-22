---
title: NimbusOps Product FAQ
access: Everyone
format: md
doc_no: NIM/ENG/GDL-002
version: 2.0
effective: 01 August 2026
review: 31 January 2027
classification: Public
department: NimbusOps Product
prepared_by: Ishaan Verma, Product Analyst – NimbusOps
approved_by: Meera Iyer, Chief Technology Officer
stamp: none
public: yes
---
# NimbusOps Product FAQ

Answers to the questions we hear most often from teams evaluating NimbusOps. For pricing, please talk to our sales team; prices depend on the number of monitored hosts and the contract term.

## 1. About NimbusOps

### What is NimbusOps?

NimbusOps is an IT operations monitoring service (SaaS) built by Nimbus Infotech. A lightweight agent on your servers, virtual machines and containers sends metrics, events and logs to NimbusOps, which evaluates your alert rules and notifies your on-call team by email, SMS, Slack, Microsoft Teams, PagerDuty or webhook.

### Who uses it?

About 140 companies, from mid-market firms to large enterprises, monitor around 186,000 hosts with NimbusOps. Nimbus Infotech's own 24x7 managed operations (NOC) team also runs on it.

### What can I connect?

More than 40 integrations, including AWS CloudWatch, Azure Monitor, VMware and ServiceNow, plus Linux and Windows hosts and Kubernetes clusters.

## 2. Plans

NimbusOps has three plans. All plans are billed per monitored host per month, on an annual contract.

| Feature | Starter | Standard | Enterprise |
|---|---|---|---|
| Alert evaluation interval | 60 seconds | 30 seconds | 30 seconds |
| Metric history | 15 days | 13 months | 13 months |
| Log retention | – | 30 days | 90 days |
| Notifications | Email and Slack | All integrations | All integrations |
| Single sign-on (SAML / OIDC) | – | – | Yes |
| Audit log export | – | – | Yes |
| Availability SLA with service credits | – | – | Yes (99.9%) |
| Named Customer Success Manager | – | – | Yes |
| AI alert summaries (from January 2027) | – | Yes | Yes |

### Can I change plans?

Yes. You can move up a plan at any time; the new plan applies from the next day and the difference is charged pro rata. Moving down a plan takes effect at your next renewal.

### Do you offer volume pricing?

Yes, larger deployments receive volume pricing automatically. Your account executive will share the details in your quote.

## 3. Availability and reliability

### What uptime does NimbusOps promise?

NimbusOps is designed for **99.9% monthly availability**. On the Enterprise plan this is a contractual SLA with service credits if we miss it. Planned maintenance is announced at least 14 days in advance.

### How do I know if there is a problem?

Live status and incident updates are published at status.nimbusops.example. During a major incident we post the first update within 30 minutes and then every 30 minutes until it is resolved.

### What happens if a whole data centre region fails?

NimbusOps runs a warm standby in a second region. Our recovery objectives are a **recovery point objective (RPO) of 15 minutes** and a **recovery time objective (RTO) of 1 hour**. We test full regional failover twice a year, in April and October.

## 4. Security and data

### Where is my data stored?

All NimbusOps customer data is stored in India, in Amazon Web Services **ap-south-1 (Mumbai)**, with disaster recovery in **ap-south-2 (Hyderabad)**. We do not replicate customer data outside India.

### Which certifications do you hold?

NimbusOps holds a **SOC 2 Type II** report, and Nimbus Infotech is certified to **ISO 27001:2022** company-wide. NimbusOps is also tested by an external penetration testing firm twice a year. Enterprise customers can request the SOC 2 report under NDA.

### Is my data encrypted?

Yes. Data is encrypted in transit with TLS 1.2 or higher (TLS 1.3 for agent traffic) and at rest with AES-256. Each customer's data is isolated from other customers at the database level.

### Does NimbusOps use my data to train AI models?

No. Your data is never used to train any model and is never shared with third parties. AI alert summaries process alert details only, inside our own AWS environment in India.

## 5. Support

| Plan | Support channels | Hours | First response for critical issues |
|---|---|---|---|
| Starter | Email, help centre | Monday–Friday, 9:00 am – 6:00 pm IST | 4 business hours |
| Standard | Email, in-app chat | 24x7 for critical issues; business hours for others | 1 hour |
| Enterprise | Email, in-app chat, phone, named CSM | 24x7 | **15 minutes** |

Support is provided by the same Nimbus team that runs our 24x7 NOC and SOC services.

## 6. Trial, contracts and cancellation

### Is there a free trial?

Yes. You get a **14-day free trial** of the Standard plan for up to **50 hosts**. No credit card is needed. At the end of the trial your account is paused, not deleted, for another 30 days so you can sign up without losing your setup.

### What is the minimum contract?

Contracts are annual. A minimum annual commitment applies; your account executive will confirm it in your quote.

### How do I cancel?

Contracts renew for another year unless you tell us otherwise. To cancel, email your account executive or support at least **30 days before your renewal date**. Service continues until the end of the paid term.

### What happens to my data when I leave?

You can export your configuration and alert history at any time. After your contract ends, all your data is deleted within **90 days**, and we issue a deletion certificate on request.

## 7. Contact

- Sales: talk to your Nimbus account executive, or use the contact form on our website.
- Support: through the help centre or in-app chat.
- Security questions: through your account executive; we respond to security questionnaires within 10 business days.
