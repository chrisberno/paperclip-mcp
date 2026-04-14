#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.PAPERCLIP_URL || "http://100.66.243.41:3100";
const EMAIL = process.env.PAPERCLIP_EMAIL || "chris@chrisberno.dev";
const PASSWORD = process.env.PAPERCLIP_PASSWORD;
const DEFAULT_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || "b2de1d02-dedc-437f-9559-c6157cc9a19f";

let sessionCookie = null;

async function authenticate() {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
    if (match) sessionCookie = `better-auth.session_token=${match[1]}`;
  }
  if (!sessionCookie) throw new Error("No session cookie returned");
}

async function api(path, options = {}) {
  if (!sessionCookie) await authenticate();

  const url = `${BASE_URL}/api${path}`;
  const headers = {
    Cookie: sessionCookie,
    Origin: BASE_URL,
    ...options.headers,
  };
  if (options.body) headers["Content-Type"] = "application/json";

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    await authenticate();
    headers.Cookie = sessionCookie;
    res = await fetch(url, { ...options, headers });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function cid(company_id) {
  return company_id || DEFAULT_COMPANY_ID;
}

const companyParam = z.string().optional().describe("Company ID (omit for Onreb, use Connie ID for Connie)");

const server = new McpServer({
  name: "paperclip",
  version: "0.1.1",
});

// --- Tools ---

server.tool("list_companies", "List all companies in the COP", {}, async () => {
  const companies = await api(`/companies`);
  return {
    content: [{ type: "text", text: JSON.stringify(companies, null, 2) }],
  };
});

server.tool("get_company", "Get company overview from the COP", {
  company_id: companyParam,
}, async ({ company_id }) => {
  const company = await api(`/companies/${cid(company_id)}`);
  return {
    content: [{ type: "text", text: JSON.stringify(company, null, 2) }],
  };
});

server.tool("list_agents", "List all agents in a COP company", {
  company_id: companyParam,
}, async ({ company_id }) => {
  const agents = await api(`/companies/${cid(company_id)}/agents`);
  return {
    content: [{ type: "text", text: JSON.stringify(agents, null, 2) }],
  };
});

server.tool(
  "get_agent",
  "Get details for a specific agent",
  {
    agent_id: z.string().describe("Agent UUID"),
    company_id: companyParam,
  },
  async ({ agent_id }) => {
    const agent = await api(`/agents/${agent_id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
    };
  }
);

server.tool(
  "create_agent",
  "Create a new agent in the COP",
  {
    name: z.string().describe("Agent name"),
    role: z
      .enum(["ceo", "cto", "cmo", "cfo", "engineer", "designer", "pm", "qa", "devops", "researcher", "general"])
      .describe("Agent role"),
    title: z.string().optional().describe("Custom title (e.g. Chief Documentation Officer)"),
    adapter_type: z.string().default("claude_local").describe("Adapter type"),
    company_id: companyParam,
  },
  async ({ name, role, title, adapter_type, company_id }) => {
    const agent = await api(`/companies/${cid(company_id)}/agents`, {
      method: "POST",
      body: JSON.stringify({
        name,
        role,
        title: title || undefined,
        adapterType: adapter_type,
        adapterConfig: {
          dangerouslySkipPermissions: true,
          instructionsBundleMode: "managed",
        },
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
    };
  }
);

server.tool(
  "update_agent",
  "Update an existing agent's fields. Only provided fields are changed; omit fields to leave them unchanged.",
  {
    agent_id: z.string().describe("Agent UUID"),
    title: z.string().optional().describe("Custom title (e.g. Chief Documentation Officer)"),
    reports_to: z
      .string()
      .optional()
      .describe("Agent UUID this agent reports to; pass empty string to clear"),
    capabilities: z.string().optional().describe("Capabilities / responsibilities description"),
    icon: z.string().optional().describe("Icon identifier or emoji"),
    budget_monthly_cents: z.number().int().optional().describe("Monthly budget in cents"),
    company_id: companyParam,
  },
  async ({ agent_id, title, reports_to, capabilities, icon, budget_monthly_cents }) => {
    const body = {};
    if (title !== undefined) body.title = title;
    if (reports_to !== undefined) body.reportsTo = reports_to === "" ? null : reports_to;
    if (capabilities !== undefined) body.capabilities = capabilities;
    if (icon !== undefined) body.icon = icon;
    if (budget_monthly_cents !== undefined) body.budgetMonthlyCents = budget_monthly_cents;

    if (Object.keys(body).length === 0) {
      throw new Error("update_agent: at least one field must be provided");
    }

    const agent = await api(`/agents/${agent_id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
    };
  }
);

server.tool(
  "list_issues",
  "List issues/tasks in a COP company",
  {
    status: z.string().optional().describe("Filter by status"),
    assignee_id: z.string().optional().describe("Filter by agent ID"),
    limit: z.number().default(20).describe("Max results"),
    company_id: companyParam,
  },
  async ({ status, assignee_id, limit, company_id }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (assignee_id) params.set("assigneeId", assignee_id);
    params.set("limit", String(limit));
    const data = await api(`/companies/${cid(company_id)}/issues?${params}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "get_issue",
  "Get details for a specific issue",
  {
    issue_id: z.string().describe("Issue UUID or identifier (e.g. ONR-1, CON-1)"),
    company_id: companyParam,
  },
  async ({ issue_id, company_id }) => {
    const issue = await api(`/companies/${cid(company_id)}/issues/${issue_id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
    };
  }
);

server.tool(
  "create_issue",
  "Create a new issue/task in the COP",
  {
    title: z.string().describe("Issue title"),
    description: z.string().optional().describe("Markdown description"),
    assignee_id: z.string().optional().describe("Agent UUID to assign"),
    priority: z.enum(["critical", "high", "medium", "low"]).default("medium").describe("Priority level"),
    company_id: companyParam,
  },
  async ({ title, description, assignee_id, priority, company_id }) => {
    const issue = await api(`/companies/${cid(company_id)}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title,
        description: description || undefined,
        assigneeAgentId: assignee_id || undefined,
        priority,
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
    };
  }
);

server.tool("get_activity", "Get recent activity log from the COP", {
  limit: z.number().default(20).describe("Max results"),
  company_id: companyParam,
}, async ({ limit, company_id }) => {
  const activity = await api(`/companies/${cid(company_id)}/activity?limit=${limit}`);
  return {
    content: [{ type: "text", text: JSON.stringify(activity, null, 2) }],
  };
});

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
