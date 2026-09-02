require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, withTransaction } = require("../config/db");

const PASSWORD = "Test@1234";
const DAY = 86400000;
const COLUMNS = ["Todo", "In Progress", "Review", "Done"];

const USERS = [
  { key: "alex", name: "Alex Rivera", email: "alex@timetoprogram.com" },
  { key: "maya", name: "Maya Chen", email: "maya@timetoprogram.com" },
  { key: "diego", name: "Diego Santos", email: "diego@timetoprogram.com" },
  { key: "priya", name: "Priya Nair", email: "priya@timetoprogram.com" },
  { key: "sam", name: "Sam Okafor", email: "sam@timetoprogram.com" },
  { key: "lena", name: "Lena Fischer", email: "lena@timetoprogram.com" },
];

const BOARDS = [
  {
    title: "Product Roadmap",
    description: "Quarterly planning, OKRs and feature prioritization.",
    color: "#2f8159",
    owner: "alex",
    members: ["maya", "diego", "priya"],
    updatedDaysAgo: 0.3,
    tasks: [
      "Define Q3 OKRs",
      "Prioritize feature backlog",
      "User interview synthesis",
      "Pricing experiment plan",
      "Competitor analysis",
      "Roadmap review with leadership",
      "Define success metrics",
      "Beta feedback triage",
      "Quarterly planning deck",
      "Stakeholder alignment",
      "Feature flag rollout plan",
      "Update public roadmap",
    ],
  },
  {
    title: "Mobile App Launch",
    description: "Ship the iOS & Android apps to the stores.",
    color: "#c26a45",
    owner: "alex",
    members: ["sam", "lena"],
    updatedDaysAgo: 1.2,
    tasks: [
      "App store listing copy",
      "Push notification setup",
      "Crash reporting integration",
      "Onboarding screens",
      "TestFlight beta",
      "Performance profiling",
      "Deep linking",
      "Release checklist",
      "Marketing screenshots",
      "App icon polish",
    ],
  },
  {
    title: "Website Redesign",
    description: "Marketing site refresh with a new design language.",
    color: "#5f7da6",
    owner: "alex",
    members: ["lena", "diego"],
    updatedDaysAgo: 2.6,
    tasks: [
      "Wireframe homepage",
      "Design hero section",
      "Implement responsive nav",
      "Migrate blog content",
      "SEO audit",
      "Accessibility pass",
      "Lighthouse optimization",
    ],
  },
  {
    title: "Marketing Q3",
    description: "Campaigns, content and growth experiments.",
    color: "#d4a23c",
    owner: "alex",
    members: ["diego", "priya"],
    updatedDaysAgo: 4,
    tasks: [
      "Launch email sequence",
      "Social media calendar",
      "Webinar planning",
      "Case study writeup",
      "Ad creative refresh",
    ],
  },
  {
    title: "Design System",
    description: "Tokens, components and documentation.",
    color: "#2c9c8f",
    owner: "alex",
    members: ["lena", "maya"],
    updatedDaysAgo: 0.8,
    tasks: [
      "Token naming audit",
      "Button component",
      "Form primitives",
      "Theme tokens",
      "Icon set cleanup",
      "Documentation site",
      "Motion guidelines",
      "Contrast review",
    ],
  },
  {
    title: "Customer Onboarding",
    description: "Make the first-run experience delightful.",
    color: "#a05d7d",
    owner: "alex",
    members: ["priya"],
    updatedDaysAgo: 6,
    tasks: [
      "Welcome email flow",
      "In-app product tour",
      "Help center articles",
      "Onboarding checklist",
    ],
  },
  {
    title: "Engineering Sprint",
    description: "Current two-week delivery sprint.",
    color: "#6f9054",
    owner: "maya",
    members: ["alex", "sam", "diego"],
    updatedDaysAgo: 1.8,
    tasks: [
      "Refactor auth module",
      "Fix websocket reconnect",
      "Add rate limiting",
      "Database index tuning",
      "API pagination",
      "Write integration tests",
      "Upgrade to Node 22",
      "Cache layer for boards",
      "Wire Sentry alerts",
      "Clear review backlog",
    ],
  },
  {
    title: "Content Calendar",
    description: "Editorial pipeline for blog & newsletter.",
    color: "#4f9d82",
    owner: "diego",
    members: ["alex", "priya"],
    updatedDaysAgo: 9,
    tasks: [
      "Blog: AI in product management",
      "Newsletter #14",
      "Customer spotlight: Acme",
    ],
  },
];

const COL_CYCLE = [0, 1, 1, 2, 3, 0, 2, 3, 1, 3, 0, 1];
const PRIO_CYCLE = [
  "medium",
  "high",
  "low",
  "urgent",
  "medium",
  "high",
  "low",
  "urgent",
];
const DUE_CYCLE = [
  -9,
  2,
  null,
  5,
  -2,
  14,
  1,
  null,
  20,
  -4,
  6,
  9,
  3,
  null,
  12,
  -1,
  7,
];

const run = async () => {
  await withTransaction(async (c) => {
    await c.query("DELETE FROM users WHERE email = ANY($1)", [
      USERS.map((u) => u.email.toLowerCase()),
    ]);

    const hash = await bcrypt.hash(PASSWORD, 10);
    const uid = {};
    for (const u of USERS) {
      const { rows } = await c.query(
        `INSERT INTO users (name, email, password_hash, created_at)
         VALUES ($1, $2, $3, now() - interval '60 days') RETURNING id`,
        [u.name, u.email.toLowerCase(), hash],
      );
      uid[u.key] = rows[0].id;
    }

    let taskTotal = 0;

    for (const b of BOARDS) {
      const ownerId = uid[b.owner];
      const updatedAt = new Date(Date.now() - b.updatedDaysAgo * DAY);

      const { rows: br } = await c.query(
        `INSERT INTO boards (title, description, color, owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now() - interval '45 days', $5) RETURNING id`,
        [b.title, b.description, b.color, ownerId, updatedAt],
      );

      const boardId = br[0].id;

      let memberKeys = [b.owner, ...b.members];
      if (!memberKeys.includes("alex")) memberKeys.push("alex");
      memberKeys = [...new Set(memberKeys)];

      for (let mi = 0; mi < memberKeys.length; mi++) {
        const mk = memberKeys[mi];
        const role = mk === b.owner ? "owner" : mi === 1 ? "admin" : "member";

        await c.query(
          `INSERT INTO board_members (board_id, user_id, role)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [boardId, uid[mk], role],
        );
      }

      const colIds = [];

      for (let i = 0; i < COLUMNS.length; i++) {
        const { rows: cr } = await c.query(
          `INSERT INTO columns (board_id, title, position) VALUES ($1, $2, $3) RETURNING id`,
          [boardId, COLUMNS[i], (i + 1) * 1000],
        );

        colIds.push(cr[0].id);
      }

      const assignPool = ["alex", "alex", ...memberKeys];

      for (let i = 0; i < b.tasks.length; i++) {
        const colIdx = COL_CYCLE[i % COL_CYCLE.length];
        const priority = PRIO_CYCLE[(i + b.title.length) % PRIO_CYCLE.length];
        const offset = DUE_CYCLE[(i + b.tasks.length) % DUE_CYCLE.length];
        const dueDate =
          offset === null ? null : new Date(Date.now() + offset * DAY);
        const assigneeKey =
          i % 5 === 4 ? null : assignPool[i % assignPool.length];
        const assigneeId = assigneeKey ? uid[assigneeKey] : null;

        await c.query(
          `INSERT INTO tasks
            (board_id, column_id, title, description, priority, due_date, assignee_id, position, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - interval '20 days', $10)`,
          [
            boardId,
            colIds[colIdx],
            b.tasks[i],
            i % 3 === 0
              ? `${b.tasks[i]} - details and acceptance criteria.`
              : null,
            priority,
            dueDate,
            assigneeId,
            (i + 1) * 1000,
            ownerId,
            updatedAt,
          ],
        );

        taskTotal += 1;
      }

      const ownerName = USERS.find((u) => u.key === b.owner).name;

      const acts = [
        { action: "board.created", message: `${ownerName} created the board` },
        {
          action: "task.created",
          message: `${ownerName} added "${b.tasks[0]}"`,
        },
        {
          action: "task.moved",
          message: `${USERS.find((u) => u.key === memberKeys[1] || u.key === b.owner)?.name || ownerName} moved "${b.tasks[Math.min(3, b.tasks.length - 1)]}" to Review`,
        },
      ];

      for (let ai = 0; ai < acts.length; ai++) {
        await c.query(
          `INSERT INTO activities (board_id, user_id, action, message, created_at)
           VALUES ($1, $2, $3, $4, now() - ($5 || ' hours')::interval)`,
          [boardId, ownerId, acts[ai].action, acts[ai].message, (ai + 1) * 7],
        );
      }
    }

    return taskTotal;
  }).then((taskTotal) => {
    console.log("✅ Demo workspace seeded.");
    console.log(
      `   Users: ${USERS.length}    Boards: ${BOARDS.length}    Tasks: ${taskTotal}`,
    );
    console.log("   Login: alex@timetoprogram.com  /  Test@1234");
    console.log("   (teammates share the same password)");
  });
};

run()
  .catch((err) => {
    console.error("❌ Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
