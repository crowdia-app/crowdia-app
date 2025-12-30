/**
 * Script to geocode locations and organizations from CSV files
 * and generate SQL INSERT statements or import directly to Supabase.
 *
 * Usage:
 *   npx tsx scripts/geocode-and-import.ts          # Generate SQL only
 *   npx tsx scripts/geocode-and-import.ts --import # Import to Supabase (requires service role key)
 *
 * Requires for --import: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import * as fs from 'fs'
import * as path from 'path'

// Rate limit delay for Nominatim (1 request per second)
const GEOCODE_DELAY_MS = 1100

interface GeocodedLocation {
  name: string
  address: string
  lat: number
  lng: number
  website_url: string | null
  venue_type: string | null
  seasonality: string | null
}

interface Organization {
  organization_name: string
  instagram_handle: string | null
  phone: string | null
  email: string | null
  website_url: string | null
}

// OpenStreetMap Nominatim geocoding
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const encoded = encodeURIComponent(address)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CrowdiaApp/1.0 (contact@crowdia.app)', // Required by Nominatim
      },
    })

    if (!response.ok) {
      console.error(`Geocoding failed for "${address}": ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.length === 0) {
      console.warn(`No results for "${address}"`)
      return null
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error)
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Parse locations CSV
function parseLocationsCSV(filePath: string): Array<{
  name: string
  address: string
  comune: string
  venueType: string
  seasonality: string
  status: string
  website: string
}> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').slice(1) // Skip header

  return lines
    .filter((line) => line.trim() && !line.startsWith(',')) // Skip empty lines
    .map((line) => {
      // Parse CSV (handle commas in quoted strings)
      const matches = line.match(/(".*?"|[^,]+|(?<=,)(?=,))/g) || []
      const fields = matches.map((f) => f.replace(/^"|"$/g, '').trim())

      return {
        name: fields[0] || '',
        address: fields[1] || '',
        comune: fields[2] || '',
        venueType: fields[3] || '',
        seasonality: fields[4] || '',
        status: fields[5] || '',
        website: fields[6] || '',
      }
    })
    .filter((loc) => loc.name) // Filter out entries without a name
}

// Parse organizations CSV
function parseOrganizationsCSV(filePath: string): Organization[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').slice(1) // Skip header

  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const fields = line.split(',').map((f) => f.trim())

      // Clean instagram handle (remove @)
      let instagram = fields[1] || null
      if (instagram?.startsWith('@')) {
        instagram = instagram.slice(1)
      }

      // Clean phone (remove spaces)
      let phone = fields[2] || null
      if (phone) {
        phone = phone.replace(/\s/g, '')
      }

      return {
        organization_name: fields[0] || '',
        instagram_handle: instagram,
        phone: phone,
        email: fields[3] || null,
        website_url: fields[4] || null,
      }
    })
    .filter((org) => org.organization_name)
}

function escapeSQL(str: string | null): string {
  if (str === null) return 'NULL'
  return `'${str.replace(/'/g, "''")}'`
}

function generateLocationSQL(locations: GeocodedLocation[]): string {
  const values = locations
    .map(
      (loc) =>
        `(${escapeSQL(loc.name)}, ${escapeSQL(loc.address)}, ${loc.lat}, ${loc.lng}, ${escapeSQL(loc.website_url)}, ${escapeSQL(loc.venue_type)}, ${escapeSQL(loc.seasonality)})`
    )
    .join(',\n  ')

  return `INSERT INTO locations (name, address, lat, lng, website_url, venue_type, seasonality)
VALUES
  ${values}
ON CONFLICT DO NOTHING;`
}

function generateOrganizerSQL(orgs: Organization[]): string {
  const values = orgs
    .map(
      (org) =>
        `(${escapeSQL(org.organization_name)}, ${escapeSQL(org.instagram_handle)}, ${escapeSQL(org.phone)}, ${escapeSQL(org.email)}, ${escapeSQL(org.website_url)})`
    )
    .join(',\n  ')

  return `INSERT INTO organizers (organization_name, instagram_handle, phone, email, website_url)
VALUES
  ${values}
ON CONFLICT DO NOTHING;`
}

async function main() {
  // File paths - use process.cwd() for compatibility
  const docsDir = path.join(process.cwd(), 'docs')
  const locationsFile = path.join(
    docsDir,
    'Club List - peró Nella LISTA hai anche tolto alcune voci, le....csv'
  )
  const organizationsFile = path.join(
    docsDir,
    'Organizations - organizza questi dati in una spread sheets google....csv'
  )

  console.error('=== Parsing CSV files ===\n')

  // Parse locations
  const rawLocations = parseLocationsCSV(locationsFile)
  console.error(`Found ${rawLocations.length} locations in CSV`)

  // Parse organizations
  const organizations = parseOrganizationsCSV(organizationsFile)
  console.error(`Found ${organizations.length} organizations in CSV\n`)

  // Geocode locations
  console.error('=== Geocoding locations ===\n')
  const geocodedLocations: GeocodedLocation[] = []

  for (const loc of rawLocations) {
    // Skip closed/inactive venues for now (optional - remove this filter to include all)
    if (loc.status.includes('CHIUSO') || loc.status.includes('SILENTE')) {
      console.error(`Skipping closed venue: ${loc.name}`)
      continue
    }

    // Build full address for geocoding
    let fullAddress = loc.address
    if (loc.comune) {
      // Extract city from "Palermo (Centro)" format
      const city = loc.comune.split('(')[0].trim()
      if (!fullAddress.toLowerCase().includes(city.toLowerCase())) {
        fullAddress += `, ${city}`
      }
    }
    // Ensure Italy is included
    if (!fullAddress.toLowerCase().includes('italia') && !fullAddress.toLowerCase().includes('italy')) {
      fullAddress += ', Italia'
    }

    console.error(`Geocoding: ${loc.name} - "${fullAddress}"`)
    const coords = await geocodeAddress(fullAddress)

    if (coords) {
      geocodedLocations.push({
        name: loc.name,
        address: loc.address + (loc.comune ? `, ${loc.comune}` : ''),
        lat: coords.lat,
        lng: coords.lng,
        website_url: loc.website || null,
        venue_type: loc.venueType || null,
        seasonality: loc.seasonality || null,
      })
      console.error(`  ✓ Found: ${coords.lat}, ${coords.lng}`)
    } else {
      console.error(`  ✗ Not found, skipping`)
    }

    // Rate limit
    await sleep(GEOCODE_DELAY_MS)
  }

  console.error(`\nGeocoded ${geocodedLocations.length} locations\n`)

  // Generate SQL
  console.error('=== Generating SQL ===\n')

  const locationSQL = generateLocationSQL(geocodedLocations)
  const organizerSQL = generateOrganizerSQL(organizations)

  // Output SQL to stdout (can be piped to a file or run via MCP)
  console.log('-- Locations')
  console.log(locationSQL)
  console.log('')
  console.log('-- Organizations')
  console.log(organizerSQL)

  console.error('\n=== SQL generation complete ===')
  console.error(`Generated SQL for ${geocodedLocations.length} locations and ${organizations.length} organizations`)
}

main().catch(console.error)
