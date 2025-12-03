// app/api/daily/route.js

export const runtime = "nodejs";

// ----------------- Utility helpers -----------------

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Approximate moon phase calculation
function getMoonPhaseInfo(date = new Date()) {
  const synodicMonth = 29.53058867;
  const reference = Date.UTC(2000, 0, 6, 18, 14, 0);

  const nowUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );

  const daysSince = (nowUtc - reference) / (1000 * 60 * 60 * 24);
  const lunations = daysSince / synodicMonth;
  let phase = lunations - Math.floor(lunations);

  if (phase < 0) phase += 1;

  let phaseName;
  if (phase < 0.03 || phase > 0.97) phaseName = "New Moon";
  else if (phase < 0.22) phaseName = "Waxing Crescent";
  else if (phase < 0.28) phaseName = "First Quarter";
  else if (phase < 0.47) phaseName = "Waxing Gibbous";
  else if (phase < 0.53) phaseName = "Full Moon";
  else if (phase < 0.72) phaseName = "Waning Gibbous";
  else if (phase < 0.78) phaseName = "Last Quarter";
  else phaseName = "Waning Crescent";

  const illumination = Math.round(phase * 100);

  return { phase, phaseName, illumination };
}

// Huntsville coordinates
const HUNTSVILLE_LAT = 34.73;
const HUNTSVILLE_LON = -86.5859;

// Weather code descriptions
function describeWeatherCode(code) {
  if (code === 0) return "clear sky";
  if (code >= 1 && code <= 3) return "partly to mostly cloudy";
  if (code === 45 || code === 48) return "foggy";
  if (code === 51 || code === 53 || code === 55) return "light to moderate drizzle";
  if (code === 56 || code === 57) return "freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "light to heavy rain";
  if (code === 66 || code === 67) return "freezing rain";
  if (code === 71 || code === 73 || code === 75) return "light to heavy snow";
  if (code === 77) return "snow grains";
  if (code === 80 || code === 81 || code === 82) return "rain showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code === 95) return "thunderstorm";
  if (code === 96 || code === 99) return "thunderstorm with hail";
  return "unsettled conditions";
}

async function getWeatherSummary() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${HUNTSVILLE_LAT}` +
    `&longitude=${HUNTSVILLE_LON}` +
    `&current=temperature_2m,weather_code` +
    `&temperature_unit=fahrenheit` +
    `&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Weather API error: ${res.status}`);
    }
    const data = await res.json();
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code;

    if (temp == null || code == null) {
      return "Weather data is not available right now.";
    }

    const desc = describeWeatherCode(code);
    const rounded = Math.round(temp);
    return `${desc}, about ${rounded}°F in Huntsville.`;
  } catch (err) {
    console.error("Weather fetch failed:", err);
    return "Weather data is not available right now.";
  }
}

// ----------------- Tarot and Lenormand data -----------------

const TAROT_CARDS = [
  {
    name: "The Star",
    paragraph:
      "The Star suggests quiet recovery and gentle hope after difficulty. It invites you to let a little light back into places that felt drained. Progress can be slow and still meaningful at the same time.",
    keywords: [
      "hope",
      "healing",
      "renewal",
      "soft guidance",
      "emotional recovery"
    ]
  },
  {
    name: "The High Priestess",
    paragraph:
      "The High Priestess points you back to your own inner knowing. It tells you that you do not have to justify your intuition for it to matter. Today, listening inward is more important than explaining outward.",
    keywords: [
      "intuition",
      "inner voice",
      "mystery",
      "sacred pause",
      "quiet truth"
    ]
  },
  {
    name: "Two of Pentacles",
    paragraph:
      "The Two of Pentacles reflects the juggling act between energy, responsibilities, and needs. It reminds you that perfect balance is not required, only conscious adjustment. Small shifts in your routine can create more ease than dramatic changes.",
    keywords: [
      "flexibility",
      "time management",
      "priorities",
      "adaptation",
      "practical choices"
    ]
  }
];

const LENORMAND_CARDS = [
  {
    name: "Clover",
    paragraph:
      "Clover speaks of small, brief moments of luck and lightness. It suggests that minor opportunities or pleasant surprises may appear if you stay open to them. This is not about grand breakthroughs but tiny pieces of good timing.",
    keywords: ["luck", "opportunity", "short term blessing", "ease"]
  },
  {
    name: "Moon",
    paragraph:
      "Moon in Lenormand highlights emotions, intuition, and the way you are seen. It can point to the importance of emotional validation and recognition. Today, your feelings may want to be taken seriously instead of dismissed.",
    keywords: ["emotion", "intuition", "recognition", "sensitivity"]
  },
  {
    name: "Tree",
    paragraph:
      "Tree represents health, growth, and long term stability. It brings attention to habits that slowly shape your physical and emotional wellbeing. Progress here is gradual but accumulates over time.",
    keywords: ["health", "growth", "roots", "long term focus"]
  }
];

// ----------------- Markdown construction helpers -----------------

function buildMovementTable() {
  return [
    "| Walking | Wall Push-Ups | Dumbbells |",
    "|---------|---------------|-----------|",
    "|         |               |           |",
    "|         |               |           |"
  ].join("\n");
}

function buildKeywordsBlock(label, keywords) {
  return (
    `**${label} keywords and intentions**\n` +
    keywords.map(k => `- ${k}`).join("\n")
  );
}

// ----------------- Main handler -----------------

export async function GET() {
  const baseUrl = process.env.CRAFT_API_BASE_URL;
  const token = process.env.CRAFT_API_TOKEN;
  const dailyTasksUrl = process.env.DAILY_TASKS_URL || "";

  if (!baseUrl || !token) {
    return new Response(
      "Missing CRAFT_API_BASE_URL or CRAFT_API_TOKEN in environment variables.",
      { status: 500 }
    );
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const moonInfo = getMoonPhaseInfo(now);
  const weatherSummary = await getWeatherSummary();
  const tarot = pickRandom(TAROT_CARDS);
  const lenormand = pickRandom(LENORMAND_CARDS);

  const movementTable = buildMovementTable();

  // Split the ritual into separate markdown sections

  const markdownIntroAndDivination = `
"Your day is allowed to be gentle, honest, and entirely your own."

---

### How to Use this Page

This page is a daily ritual layout. Move through it in order or jump to what you need most. Nothing here is a requirement; it is simply a container for reflection, intention, and small actions.

### Tips

- Let your intention be simple and real, not impressive.
- Treat divination as guidance, not a command.
- Keep your tasks list short enough that it feels possible.
- Use the movement section as a suggestion, not a rule.
- If all you do is read this page and take one slow breath, that still counts.

---

## Date

${dateLabel}

---

## Moon Phase

Phase: ${moonInfo.phaseName}  
Approximate illumination: ${moonInfo.illumination} percent

---

## Daily Intention

Write a single intention for today.

Intention: ______________________________________

---

## Divination of the Day

### Tarot: ${tarot.name}

${tarot.paragraph}

${buildKeywordsBlock("Tarot", tarot.keywords)}

---

### Lenormand: ${lenormand.name}

${lenormand.paragraph}

${buildKeywordsBlock("Lenormand", lenormand.keywords)}

---

## Weather

${weatherSummary}
`.trim();

  const markdownTasks = `
## Top Three Tasks

- [ ] 
- [ ] 
- [ ] 
`.trim();

  const markdownMovement = `
## Movement

${movementTable}

You can use each row for sets, minutes, or any notes that make sense to you.
`.trim();

  const markdownJournal = `
## Journal

Use this space to write anything that needs to come out today.
`.trim();

  const markdownLink = (dailyTasksUrl
    ? `## Daily Tasks Collection

[Open daily tasks collection](${dailyTasksUrl})`
    : `## Daily Tasks Collection

No link configured. Add DAILY_TASKS_URL in your Vercel environment variables to enable this link.`).trim();

  // Target page
  const targetPageId = "B962E4AF-2987-486E-8D71-3C5FFACB6C19";

  // Build blocks array with styling
  const payload = {
    blocks: [
      {
        type: "text",
        textStyle: "body",
        font: "serif",
        markdown: markdownIntroAndDivination
      },
      {
        // styled tasks block: serif, card, callout, white
        type: "text",
        textStyle: "body",
        cardLayout: "regular",
        textAlignment: "left",
        font: "serif",
        listStyle: "task",
        decorations: ["callout"],
        color: "#FFFFFF",
        markdown: markdownTasks
      },
      {
        type: "text",
        textStyle: "body",
        font: "serif",
        markdown: markdownMovement
      },
      {
        type: "text",
        textStyle: "body",
        font: "serif",
        markdown: markdownJournal
      },
      {
        type: "text",
        textStyle: "body",
        font: "serif",
        markdown: markdownLink
      }
    ],
    position: {
      position: "end",
      pageId: targetPageId
    }
  };

  let craftResponseText = "";
  let craftResponseJson = null;

  try {
    const res = await fetch(`${baseUrl}/blocks`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    craftResponseText = await res.text();

    if (!res.ok) {
      return new Response(
        `Craft API returned status ${res.status}: ${craftResponseText}`,
        { status: 502 }
      );
    }

    try {
      craftResponseJson = JSON.parse(craftResponseText);
    } catch {
      craftResponseJson = null;
    }
  } catch (err) {
    console.error("Error calling Craft API:", err);
    return new Response(
      `Error calling Craft API: ${String(err)}`,
      { status: 500 }
    );
  }

  const previewMarkdown = [
    markdownIntroAndDivination,
    markdownTasks,
    markdownMovement,
    markdownJournal,
    markdownLink
  ].join("\n\n---\n\n");

  const output = {
    status: "ok",
    createdAt: now.toISOString(),
    dateLabel,
    moon: moonInfo,
    weatherSummary,
    tarot,
    lenormand,
    markdownPreview: previewMarkdown.slice(0, 300) + "...",
    craftRawResponse: craftResponseJson || craftResponseText
  };

  return new Response(JSON.stringify(output, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
