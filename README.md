# The Nation's Herald - Automated Crypto Intelligence Briefing

**A Submission for the Nation Summer Hackathon: Agent Powered Apps**

**Live Demo:** [https://nationsherald-production.up.railway.app/](https://nationsherald-production.up.railway.app/ )
**Interactive Telegram Bot:** [https://t.me/Nation_HeraldsBot](https://t.me/Nation_HeraldsBot )
**Video Demo:** [YOUTUBE VIDEO LINK HERE](https://youtu.be/Lt0zeqDp5hk)]

---

## 1. What It Does

The Nation's Herald is an autonomous intelligence platform that solves the problem of information overload in the crypto ecosystem. Every day, our system automatically:

1.  **Gathers:** Scrapes raw data from key alpha Telegram channels and other sources.
2.  **Cleans:** Processes messy, unstructured text, deduplicates identical news, and categorizes each item.
3.  **Delivers:** Presents the clean, structured report in two formats:
    *   **A Web Application:** A clean, easily scannable dashboard.
    *   **A Telegram Channel:** A proactive daily briefing delivered directly to subscribers.

The goal is to provide "Pure Signal, No Noise," saving users hours of manual research time every day.

---

## 2. How the Nation Agent API is Used

**The Nation Agent API is the core component and the "brain" of our system.** We don't just use the agent as a chatbot; we've integrated it as a **cognitive data-processing engine** within a hybrid backend workflow.

Here is the step-by-step data flow:

1.  **External Scraping:** A custom service (`channel_scraper.py`) runs daily to fetch raw, highly unstructured data from Telegram.

2.  **API Call to the Agent (The Critical Step):**
    *   Our backend orchestrator then makes a `POST` request to the **Nation Agent API**.
    *   We send the entire messy, raw data dump in the request body.
    *   We use a **specifically engineered prompt** to instruct the agent to act as an "AI Editor-in-Chief."

3.  **Cognitive Work Performed by the Agent:**
    *   Inside the Nation platform, our agent receives this data and performs the heavy lifting:
        *   **Deduplication:** Identifying the same news from different sources.
        *   **Standardization:** Extracting key fields like `title`, `description`, `category`, and `url`.
        *   **Categorization:** Grouping items into logical categories like "News," "Launch," "Update," etc.
    *   The agent then returns a single, **clean, and perfectly structured JSON object** as the response.

4.  **Distribution of Results:**
    *   Our orchestrator receives this clean JSON and uses it to:
        *   Update the database that powers the web application.
        *   Format and send the final report to our public Telegram channel.

In short, we use the **Nation Agent API** not for conversation, but as an **intelligent data-transformation service** that sits at the heart of our entire data pipeline.

---

## 3. Who It's For

The Nation's Herald is designed for anyone in the crypto space who values their time and needs curated, high-signal intelligence, including:

*   **Traders & Investors:** To get a quick, daily overview of the market.
*   **Researchers & Analysts:** To track project updates and developing narratives.
*   **Builders & Developers:** To stay updated on the latest launches and technical developments.
*   **Crypto Enthusiasts:** To stay informed without having to monitor dozens of sources constantly.

---

## 4. Tech Stack & Architecture

*   **Frontend:** Next.js, Tailwind CSS (Deployed on Vercel)
*   **Backend (Orchestrator):** Node.js, Express (Deployed on Railway)
*   **Scraper:** Python, Telethon
*   **Core Logic:** **Nation Agent API**
*   **Database:** JSON file (temporarily stored on the server)



