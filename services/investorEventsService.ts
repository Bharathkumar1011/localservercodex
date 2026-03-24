import type { InsertInvestorEvent } from "../shared/schema.js";
import { investorEventsRepository } from "../repositories/investorEventsRepository.js";

const STALE_AFTER_DAYS = 7;
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 60;
const MAX_RSS_ITEMS_PER_QUERY = 8;
const MAX_EVENTS_TO_STORE = 24;

const INDIA_CITIES = [
  "Hyderabad",
  "Mumbai",
  "Bengaluru",
  "Bangalore",
  "Delhi",
  "New Delhi",
  "Delhi NCR",
  "Gurugram",
  "Gurgaon",
  "Noida",
  "Pune",
  "Chennai",
  "Ahmedabad",
  "Kolkata",
  "Jaipur",
  "Kochi",
  "Chandigarh",
  "Indore",
  "Surat",
  "Vadodara",
  "Lucknow",
  "Bhubaneswar",
  "Coimbatore",
  "Visakhapatnam",
  "Vizag",
  "Goa",
];

const HYDERABAD_PRIORITY_TERMS = [
  "Hyderabad",
  "Gachibowli",
  "HITEC City",
  "Hitech City",
  "Financial District",
  "HICC",
  "HITEX",
  "Banjara Hills",
  "Jubilee Hills",
];

const EVENT_TERMS = [
  "conference",
  "summit",
  "conclave",
  "forum",
  "investor meet",
  "networking event",
  "roadshow",
  "demo day",
  "annual meeting",
  "capital markets event",
];

const DEFAULT_INVESTOR_TERMS = [
  "private equity",
  "venture capital",
  "family office",
  "private credit",
  "AIF",
  "CFA",
  "investment conference",
  "investor summit",
  "LP GP",
  "dealmaking",
];

const OFFICIAL_EVENT_DOMAINS = [
  "ivca.in",
  "cfasocietyindia.org",
  "hyderabad.tie.org",
  "nasscom.in",
  "ficci.in",
  "cii.in",
];
const EVENT_PLATFORM_HOSTS = [
  "10times.com",
  "allevents.in",
  "eventbrite.com",
  "meetup.com",
];

const FOREIGN_LOCATION_TERMS = [
  "south africa",
  "cape town",
  "johannesburg",
  "nairobi",
  "lagos",
  "london",
  "new york",
  "san francisco",
  "los angeles",
  "chicago",
  "boston",
  "toronto",
  "vancouver",
  "singapore",
  "hong kong",
  "dubai",
  "abu dhabi",
  "doha",
  "sydney",
  "melbourne",
  "paris",
  "berlin",
  "tokyo",
  "seoul",
  "bangkok",
  "usa",
  "u.s.",
  "united states",
  "uk",
  "u.k.",
  "united kingdom",
  "canada",
  "australia",
  "africa",
  "europe",
  "middle east",
];

const VIRTUAL_EVENT_TERMS = [
  "virtual summit",
  "virtual conference",
  "virtual event",
  "virtual investor summit",
  "webinar",
  "online event",
  "online summit",
  "online conference",
  "livestream",
  "zoom event",
  "digital summit",
];

const ARTICLE_STYLE_TITLE_TERMS = [
  "transcript",
  "earnings call",
  "results",
  "share price",
  "stock market",
  "analysis",
  "opinion",
  "insights",
  "key insights",
  "exports",
  "outlook",
  "guidance",
  "quarterly",
  "q1",
  "q2",
  "q3",
  "q4",
  "profit",
  "revenue",
  "stocks",
];

const ARTICLE_STYLE_URL_TERMS = [
  "/news/",
  "/transcripts/",
  "/analysis/",
  "/opinion/",
  "/stocks/",
  "/markets/",
  "/equities/",
];

const EVENT_URL_HINT_TERMS = [
  "/event",
  "/events",
  "/conference",
  "/summit",
  "/forum",
  "/conclave",
  "/agenda",
  "/register",
];

const INDIA_SIGNAL_TERMS = [
  "india",
  "indian",
  "hyderabad",
  "mumbai",
  "bengaluru",
  "bangalore",
  "delhi",
  "new delhi",
  "delhi ncr",
  "gurugram",
  "gurgaon",
  "noida",
  "pune",
  "chennai",
  "ahmedabad",
  "kolkata",
  "jaipur",
  "kochi",
  "chandigarh",
  "indore",
  "surat",
  "vadodara",
  "lucknow",
  "bhubaneswar",
  "coimbatore",
  "visakhapatnam",
  "vizag",
  "goa",
];




const MONTH_REGEX =
  "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

type RawRssItem = {
  title: string;
  url: string;
  source: string;
  description: string;
  publishedAt: Date;
};

type FeedResponse = {
  hyderabadEvents: any[];
  indiaEvents: any[];
  lastUpdatedAt: string | null;
  staleAfterDays: number;
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function splitMultiValue(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[,/|;&]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(
    new Set(values.map((v) => v.trim()).filter(Boolean))
  );
}

function quoteTerm(term: string) {
  return `"${term.replace(/"/g, "").trim()}"`;
}

function buildOrBlock(terms: string[]) {
  return terms.filter(Boolean).map(quoteTerm).join(" OR ");
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isOfficialSource(url: string) {
  const host = getUrlHost(url);
  return OFFICIAL_EVENT_DOMAINS.some((domain) => host.includes(domain));
}

function isEventPlatformHost(url: string) {
  const host = getUrlHost(url);
  return EVENT_PLATFORM_HOSTS.some((domain) => host.includes(domain));
}

function isOfficialLikeEventSource(url: string) {
  return isOfficialSource(url) || isEventPlatformHost(url) || hasEventPageUrlHint(url);
}

function normalizeInvestorType(type: string) {
  const lower = normalizeText(type);

  if (lower.includes("pe") || lower.includes("private equity")) {
    return ["private equity", "PE"];
  }
  if (lower.includes("vc") || lower.includes("venture capital")) {
    return ["venture capital", "VC"];
  }
  if (lower.includes("family office")) {
    return ["family office"];
  }
  if (lower.includes("bank")) {
    return ["bank", "institutional investor"];
  }
  if (lower.includes("strategic")) {
    return ["strategic investor", "corporate investor"];
  }
  if (lower.includes("aif")) {
    return ["AIF", "alternative investment fund"];
  }
  if (lower.includes("credit") || lower.includes("debt")) {
    return ["private credit", "debt fund"];
  }

  return [type];
}

function parseEventDate(text: string, publishedAt: Date): Date | null {
  const cleaned = text.replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1");

  // 12 March 2026
  const dmyRegex = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_REGEX}(?:\\s+(\\d{4}))?\\b`, "i");

  // March 12, 2026
  const mdyRegex = new RegExp(`\\b${MONTH_REGEX}\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?\\b`, "i");

  // 12-13 March 2026 -> take first day
  const dmyRangeRegex = new RegExp(`\\b(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+${MONTH_REGEX}(?:\\s+(\\d{4}))?\\b`, "i");

  // March 12-13, 2026 -> take first day
  const mdyRangeRegex = new RegExp(`\\b${MONTH_REGEX}\\s+(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})(?:,\\s*(\\d{4}))?\\b`, "i");

  const dmyRangeMatch = cleaned.match(dmyRangeRegex);
  if (dmyRangeMatch) {
    const day = Number(dmyRangeMatch[1]);
    const month = dmyRangeMatch[3];
    const year = Number(dmyRangeMatch[4] || publishedAt.getFullYear());
    const parsed = new Date(`${month} ${day}, ${year} 12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const mdyRangeMatch = cleaned.match(mdyRangeRegex);
  if (mdyRangeMatch) {
    const month = mdyRangeMatch[1];
    const day = Number(mdyRangeMatch[2]);
    const year = Number(mdyRangeMatch[4] || publishedAt.getFullYear());
    const parsed = new Date(`${month} ${day}, ${year} 12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dmyMatch = cleaned.match(dmyRegex);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = dmyMatch[2];
    const year = Number(dmyMatch[3] || publishedAt.getFullYear());
    const parsed = new Date(`${month} ${day}, ${year} 12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const mdyMatch = cleaned.match(mdyRegex);
  if (mdyMatch) {
    const month = mdyMatch[1];
    const day = Number(mdyMatch[2]);
    const year = Number(mdyMatch[3] || publishedAt.getFullYear());
    const parsed = new Date(`${month} ${day}, ${year} 12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function detectCity(text: string, trackedCities: string[]) {
  const normalized = normalizeText(text);

  const cityAliasMap: Record<string, string[]> = {
    Hyderabad: ["hyderabad", "gachibowli", "hitec city", "hitech city", "financial district", "hicc", "hitex"],
    Mumbai: ["mumbai", "bombay"],
    Bengaluru: ["bengaluru", "bangalore"],
    "Delhi NCR": ["delhi ncr", "gurugram", "gurgaon", "noida", "ncr"],
    Delhi: ["new delhi", "delhi"],
    Pune: ["pune"],
    Chennai: ["chennai"],
    Ahmedabad: ["ahmedabad"],
    Kolkata: ["kolkata", "calcutta"],
    Jaipur: ["jaipur"],
    Kochi: ["kochi", "cochin"],
    Chandigarh: ["chandigarh"],
    Indore: ["indore"],
    Surat: ["surat"],
    Vadodara: ["vadodara", "baroda"],
    Lucknow: ["lucknow"],
    Bhubaneswar: ["bhubaneswar"],
    Coimbatore: ["coimbatore"],
    Visakhapatnam: ["visakhapatnam", "vizag"],
    Goa: ["goa"],
  };


  

  for (const [city, aliases] of Object.entries(cityAliasMap)) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return city;
    }
  }

  for (const city of trackedCities) {
    if (normalized.includes(normalizeText(city))) {
      return city;
    }
  }

  return null;
}



function hasForeignLocationSignal(text: string) {
  const normalized = normalizeText(text);
  return FOREIGN_LOCATION_TERMS.some((term) => normalized.includes(normalizeText(term)));
}

function isVirtualOnlyEvent(text: string) {
  const normalized = normalizeText(text);
  return VIRTUAL_EVENT_TERMS.some((term) => normalized.includes(normalizeText(term)));
}

function hasIndiaSignal(text: string, url?: string) {
  const normalized = normalizeText(text);
  const host = url ? getUrlHost(url) : "";

  const hasIndiaText = INDIA_SIGNAL_TERMS.some((term) =>
    normalized.includes(normalizeText(term))
  );

  const isOfficialIndianSource = isOfficialSource(url || "");
  const isIndianDomain = host.endsWith(".in");

  return hasIndiaText || isOfficialIndianSource || isIndianDomain;
}


function isArticleStyleItem(title: string, description: string, url: string) {
  const combined = normalizeText(`${title} ${description}`);
  const normalizedUrl = url.toLowerCase();

  const hasArticleTitleSignal = ARTICLE_STYLE_TITLE_TERMS.some((term) =>
    combined.includes(normalizeText(term))
  );

  const hasArticleUrlSignal = ARTICLE_STYLE_URL_TERMS.some((term) =>
    normalizedUrl.includes(term)
  );

  return hasArticleTitleSignal || hasArticleUrlSignal;
}

function hasEventPageUrlHint(url: string) {
  const normalizedUrl = url.toLowerCase();
  return EVENT_URL_HINT_TERMS.some((term) => normalizedUrl.includes(term));
}

function hasStrongEventIntent(text: string) {
  const normalized = normalizeText(text);

  const primaryEventTerms = EVENT_TERMS.some((term) =>
    normalized.includes(normalizeText(term))
  );

  const eventSpecificInvestorPhrases = [
    "investment conference",
    "investor summit",
    "lp gp",
    "capital markets event",
    "investor meet",
    "networking event",
  ].some((term) => normalized.includes(normalizeText(term)));

  return primaryEventTerms || eventSpecificInvestorPhrases;
}





function scoreEvent(params: {
  title: string;
  description: string;
  url: string;
  eventDate: Date | null;
  city: string | null;
  matchedSectors: string[];
  matchedInvestorTypes: string[];
}) {
  const combinedText = normalizeText(`${params.title} ${params.description}`);
  const now = new Date();

  let score = 0;

  if (params.city === "Hyderabad") score += 100;
  if (HYDERABAD_PRIORITY_TERMS.some((term) => combinedText.includes(normalizeText(term)))) score += 25;
  if (EVENT_TERMS.some((term) => combinedText.includes(normalizeText(term)))) score += 18;
  if (DEFAULT_INVESTOR_TERMS.some((term) => combinedText.includes(normalizeText(term)))) score += 15;
  if (isOfficialSource(params.url)) score += 20;

  score += Math.min(params.matchedSectors.length * 4, 20);
  score += Math.min(params.matchedInvestorTypes.length * 4, 16);

  if (params.eventDate) {
    if (params.eventDate >= now) {
      score += 20;
    } else {
      score += 8;
    }
  } else {
    score += 4;
  }

  return score;
}

function withinWindow(date: Date) {
  const now = new Date();

  const start = new Date(now);
  start.setDate(start.getDate() - LOOKBACK_DAYS);

  const end = new Date(now);
  end.setDate(end.getDate() + LOOKAHEAD_DAYS);

  return date >= start && date <= end;
}

function normalizeTitle(title: string) {
  return title
    .replace(/\s+-\s+[^-]+$/, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function fetchGoogleNewsRss(query: string): Promise<RawRssItem[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;

    const response = await fetch(rssUrl);
    if (!response.ok) return [];

    const text = await response.text();

    const items: RawRssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const linkRegex = /<link>([\s\S]*?)<\/link>/;
    const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
    const sourceRegex = /<source.*?>([\s\S]*?)<\/source>/;
    const descriptionRegex = /<description>([\s\S]*?)<\/description>/;

    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = itemRegex.exec(text)) !== null && count < MAX_RSS_ITEMS_PER_QUERY) {
      const content = match[1];

      const titleMatch = content.match(titleRegex);
      const linkMatch = content.match(linkRegex);
      const dateMatch = content.match(dateRegex);
      const sourceMatch = content.match(sourceRegex);
      const descriptionMatch = content.match(descriptionRegex);

      if (!titleMatch || !linkMatch) continue;

      items.push({
        title: decodeHtml(titleMatch[1]),
        url: decodeHtml(linkMatch[1]),
        source: sourceMatch ? decodeHtml(sourceMatch[1]) : "Google News",
        description: descriptionMatch ? stripTags(decodeHtml(descriptionMatch[1])) : "",
        publishedAt: dateMatch ? new Date(dateMatch[1]) : new Date(),
      });

      count += 1;
    }

    return items;
  } catch (error) {
    console.error("[InvestorEvents] RSS fetch failed:", error);
    return [];
  }
}

class InvestorEventsService {
  private buildQueries(metadataRows: Array<{ sector: string | null; investorType: string | null; location: string | null }>) {
    const sectors = unique(metadataRows.flatMap((row) => splitMultiValue(row.sector))).slice(0, 8);
    const investorTypes = unique(
      metadataRows.flatMap((row) => splitMultiValue(row.investorType)).flatMap(normalizeInvestorType)
    ).slice(0, 8);

    const locations = unique(metadataRows.flatMap((row) => splitMultiValue(row.location))).slice(0, 8);

    const typeTerms = investorTypes.length > 0 ? investorTypes : DEFAULT_INVESTOR_TERMS;
    const cityTerms = unique(["Hyderabad", ...locations, ...INDIA_CITIES]).slice(0, 10);
    const sectorTerms = sectors.length > 0 ? sectors : ["Financial Services", "Fintech", "Healthcare", "Renewables", "Logistics", "Technology"];

    const officialSitesBlock = OFFICIAL_EVENT_DOMAINS.map((domain) => `site:${domain}`).join(" OR ");

    const queries = [
      `(${buildOrBlock(typeTerms)}) AND (${buildOrBlock(EVENT_TERMS)}) AND (${buildOrBlock(HYDERABAD_PRIORITY_TERMS)}) AND India when:90d`,
      `(${buildOrBlock(sectorTerms)}) AND (${buildOrBlock(EVENT_TERMS)}) AND (${buildOrBlock(HYDERABAD_PRIORITY_TERMS)}) AND India when:90d`,
      `(${buildOrBlock(typeTerms)}) AND (${buildOrBlock(EVENT_TERMS)}) AND (${buildOrBlock(cityTerms)}) AND India when:90d`,
      `(${buildOrBlock(sectorTerms)}) AND (${buildOrBlock(["investor conference", "investment summit", "industry forum", "capital markets event"])}) AND (${buildOrBlock(cityTerms)}) AND India when:90d`,
      `(${buildOrBlock(typeTerms)}) AND (${buildOrBlock(EVENT_TERMS)}) AND (${buildOrBlock(["Hyderabad", "India"])}) AND (${officialSitesBlock}) when:180d`,
    ];

    return {
      queries,
      sectors,
      investorTypes,
      trackedCities: unique(["Hyderabad", ...locations, ...INDIA_CITIES]),
    };
  }

  private async fetchAndBuildFreshEvents(organizationId: number): Promise<InsertInvestorEvent[]> {
    const metadataRows = await investorEventsRepository.getInvestorSearchMetadata(organizationId);
    const { queries, sectors, investorTypes, trackedCities } = this.buildQueries(metadataRows);

    const rssResults = await Promise.all(queries.map((query) => fetchGoogleNewsRss(query)));
    const flatItems = rssResults.flat();

    const deduped = new Map<string, InsertInvestorEvent>();

    const debugCounts = {
      total: flatItems.length,
      noParsedDate: 0,
      outOfWindow: 0,
      noEventIntent: 0,
      blockedHost: 0,
      articleStyle: 0,
      foreign: 0,
      virtualOnly: 0,
      noIndiaSignal: 0,
      noCityForNonOfficial: 0,
      kept: 0,
    };

    for (const item of flatItems) {
      const cleanTitle = item.title.replace(/\s+-\s+[^-]+$/, "").trim();
      const combinedText = `${cleanTitle} ${item.description} ${item.source}`;

      const parsedEventDate = parseEventDate(combinedText, item.publishedAt);
      const officialLikeEventSource = isOfficialLikeEventSource(item.url);

      if (!parsedEventDate && !officialLikeEventSource) {
        debugCounts.noParsedDate += 1;
        continue;
      }

      const eventDate = parsedEventDate ?? null;

      if (eventDate && !withinWindow(eventDate)) {
        debugCounts.outOfWindow += 1;
        continue;
      }

      if (!eventDate && !withinWindow(item.publishedAt)) {
        debugCounts.outOfWindow += 1;
        continue;
      }

      const lowerCombined = normalizeText(combinedText);

      const matchedSectors = sectors.filter((sector) =>
        lowerCombined.includes(normalizeText(sector))
      );

      const matchedInvestorTypes = investorTypes.filter((type) =>
        lowerCombined.includes(normalizeText(type))
      );

      const hasEventIntent = hasStrongEventIntent(combinedText);

      const blockedSourceHosts = [
        "businesswire.com",
        "afdb.org",
        "scanx.trade",
        "investing.com",
        "observervoice.com",
      ];

      const itemHost = getUrlHost(item.url);
      const isBlockedHost = blockedSourceHosts.some((host) => itemHost.includes(host));

      const articleStyleItem = isArticleStyleItem(cleanTitle, item.description, item.url);
      const eventPageUrlHint = hasEventPageUrlHint(item.url);

      if (!hasEventIntent) {
        debugCounts.noEventIntent += 1;
        continue;
      }

      if (isBlockedHost) {
        debugCounts.blockedHost += 1;
        continue;
      }

      if (articleStyleItem && !eventPageUrlHint && !isOfficialSource(item.url)) {
        debugCounts.articleStyle += 1;
        continue;
      }

      const city = detectCity(combinedText, trackedCities);
      const hasForeignLocation = hasForeignLocationSignal(combinedText);
      const virtualOnly = isVirtualOnlyEvent(combinedText);
      const indiaSignal = hasIndiaSignal(combinedText, item.url);
      const officialSource = isOfficialSource(item.url);

      if (hasForeignLocation) {
        debugCounts.foreign += 1;
        continue;
      }

      if (virtualOnly) {
        debugCounts.virtualOnly += 1;
        continue;
      }

      if (!indiaSignal) {
        debugCounts.noIndiaSignal += 1;
        continue;
      }

      // Relaxed from earlier version:
      // allow official-like / event-page-like sources even if city is missing in the RSS snippet
      if (!officialLikeEventSource && !city) {
        debugCounts.noCityForNonOfficial += 1;
        continue;
      }

      const priorityScore = scoreEvent({
        title: cleanTitle,
        description: item.description,
        url: item.url,
        eventDate,
        city,
        matchedSectors,
        matchedInvestorTypes,
      });

      const matchedKeywords = unique([
        ...matchedSectors,
        ...matchedInvestorTypes,
        ...EVENT_TERMS.filter((term) => lowerCombined.includes(normalizeText(term))),
      ]).slice(0, 10);

      const hyderabadSignal =
        city === "Hyderabad" ||
        HYDERABAD_PRIORITY_TERMS.some((term) =>
          lowerCombined.includes(normalizeText(term))
        );

      const row: InsertInvestorEvent = {
        organizationId,
        title: cleanTitle,
        url: item.url,
        source: item.source,
        sourceType: isOfficialLikeEventSource(item.url) ? "official_site" : "google_news",
        eventDate,
        publishedAt: item.publishedAt,
        city,
        locationText: city ?? (officialLikeEventSource ? "India" : null),
        organizer: item.source,
        priorityScore,
        isHyderabadPriority: hyderabadSignal,
        matchedInvestorType: matchedInvestorTypes[0] ?? null,
        matchedSectors,
        matchedKeywords,
      };

      const dateKey = eventDate ? eventDate.toISOString().slice(0, 10) : "nodate";
      const dedupeKey = `${normalizeTitle(cleanTitle)}|${city ?? "unknown"}|${dateKey}`;

      const existing = deduped.get(dedupeKey);
      if (!existing || (row.priorityScore ?? 0) > (existing.priorityScore ?? 0)) {
        deduped.set(dedupeKey, row);
      }
    }

    const finalRows = Array.from(deduped.values())
      .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
      .slice(0, MAX_EVENTS_TO_STORE);

    debugCounts.kept = finalRows.length;
    console.log("[InvestorEvents] filter summary:", debugCounts);

    return finalRows;
  }

  async getInvestorEventsFeed(
    organizationId: number,
    forceRefresh = false
  ): Promise<FeedResponse> {
    const cachedEvents = await investorEventsRepository.getCachedEvents(organizationId);
    const lastCreatedAt = await investorEventsRepository.getLatestCreatedAt(organizationId);

    const now = new Date();
    const staleCutoff = new Date(now);
    staleCutoff.setDate(staleCutoff.getDate() - STALE_AFTER_DAYS);

    const isStale =
      forceRefresh ||
      cachedEvents.length === 0 ||
      !lastCreatedAt ||
      lastCreatedAt < staleCutoff;

    let finalEvents = cachedEvents;

    if (isStale) {
      const freshEvents = await this.fetchAndBuildFreshEvents(organizationId);

      const shouldReplaceCache = forceRefresh || freshEvents.length > 0;

      if (shouldReplaceCache) {
        await investorEventsRepository.replaceEvents(organizationId, freshEvents);
        finalEvents = await investorEventsRepository.getCachedEvents(organizationId);
      }
    }

    return {
      hyderabadEvents: finalEvents.filter((item) => item.isHyderabadPriority).slice(0, 8),
      indiaEvents: finalEvents.filter((item) => !item.isHyderabadPriority).slice(0, 10),
      lastUpdatedAt: (await investorEventsRepository.getLatestCreatedAt(organizationId))?.toISOString() ?? null,
      staleAfterDays: STALE_AFTER_DAYS,
    };
  }
}

export const investorEventsService = new InvestorEventsService();