/**
 * Dedicated fetcher for Resident Advisor (ra.co) using their GraphQL API
 * This bypasses Cloudflare protection since the API is accessible
 */

const RA_GRAPHQL_URL = "https://ra.co/graphql";

interface RAEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  contentUrl: string;
  images?: { filename: string }[];
  venue?: {
    name: string;
    address?: string;
    area?: { name: string };
  };
  artists?: { name: string }[];
}

interface RAEventListing {
  id: string;
  listingDate: string;
  event: RAEvent;
}

interface RAEventsResponse {
  data?: {
    eventListings?: {
      data: RAEventListing[];
      totalResults: number;
    };
  };
  errors?: { message: string }[];
}

/**
 * Fetch events from RA.co using their GraphQL API
 */
export async function fetchRAEvents(areaId: string = "302"): Promise<string> {
  // Area 302 is Sicily (Italy)
  const query = `
    query GetEventListings($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
      eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
        data {
          id
          listingDate
          event {
            id
            title
            date
            startTime
            endTime
            contentUrl
            images {
              filename
            }
            venue {
              name
              address
            }
            artists {
              name
            }
          }
        }
        totalResults
      }
    }
  `;

  // Get today's date in ISO format for filtering
  const today = new Date().toISOString().split("T")[0];

  const variables = {
    filters: {
      areas: { eq: parseInt(areaId) },
      listingDate: { gte: today }, // Only get upcoming events
    },
    pageSize: 30,
    page: 1,
  };

  try {
    const response = await fetch(RA_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": "https://ra.co",
        "Referer": "https://ra.co/events/it/sicily",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`RA.co API failed: ${response.status}`);
    }

    const data = (await response.json()) as RAEventsResponse;

    if (data.errors && data.errors.length > 0) {
      throw new Error(`RA.co GraphQL errors: ${data.errors.map(e => e.message).join(", ")}`);
    }

    const listings = data.data?.eventListings?.data || [];

    if (listings.length === 0) {
      return "No events found for this area.";
    }

    // Convert to the structured format the LLM expects
    const formattedEvents = listings.map((listing) => {
      const event = listing.event;
      // Handle image URL - might be a full URL or just a filename
      let imageUrl = "";
      const filename = event.images?.[0]?.filename;
      if (filename) {
        if (filename.startsWith("http")) {
          imageUrl = filename;
        } else {
          imageUrl = `https://ra.co/images/events/flyer/${filename}`;
        }
      }
      const eventUrl = `https://ra.co${event.contentUrl}`;
      const venue = event.venue?.name || "TBA";
      const address = event.venue?.address || "";
      const artists = event.artists?.map((a) => a.name).join(", ") || "";

      let entry = `EVENT: ${event.title}`;
      entry += `\n  URL: ${eventUrl}`;
      if (imageUrl) entry += `\n  IMAGE: ${imageUrl}`;
      entry += `\n  DATE: ${event.date} ${event.startTime || ""}`;
      if (venue) entry += `\n  VENUE: ${venue}`;
      if (address) entry += `\n  ADDRESS: ${address}`;
      if (artists) entry += `\n  ARTISTS: ${artists}`;

      return entry;
    });

    return formattedEvents.join("\n\n");
  } catch (error) {
    console.error("RA.co GraphQL fetch failed:", error);
    throw error;
  }
}

/**
 * Check if a URL is for RA.co
 */
export function isRAUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "ra.co" || hostname === "www.ra.co";
  } catch {
    return false;
  }
}
