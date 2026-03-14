async function probe(label: string, url: string) {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 8000)
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
      },
    })
    clearTimeout(t)
    const ct = r.headers.get('content-type') ?? ''
    let body = await r.text()
    if (ct.includes('json')) {
      try {
        const j = JSON.parse(body)
        body = JSON.stringify(j).slice(0, 200)
      } catch {}
    } else {
      body = body.slice(0, 150)
    }
    console.log(`\n[${label}] HTTP ${r.status} ${ct.split(';')[0]}`)
    console.log(`  Body: ${body}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`\n[${label}] FAILED: ${msg.slice(0, 100)}`)
  }
}

async function main() {
  console.log('=== Probing University SIS Endpoints ===\n')

  // AUB Banner SIS
  await probe('AUB Banner - term list', 'https://ssb.aub.edu.lb/StudentRegistrationSsb/ssb/classSearch/getTerms?searchTerm=&offset=1&max=10')
  await probe('AUB Banner - course search (no session)', 'https://ssb.aub.edu.lb/StudentRegistrationSsb/ssb/courseSearchResults/courseSearchResults?txt_term=202510&pageOffset=0&pageMaxSize=5')

  // LAU Banner SIS
  await probe('LAU Banner - term list', 'https://ssb.lau.edu.lb/StudentRegistrationSsb/ssb/classSearch/getTerms?searchTerm=&offset=1&max=10')
  await probe('LAU Banner - course search', 'https://ssb.lau.edu.lb/StudentRegistrationSsb/ssb/courseSearchResults/courseSearchResults?txt_term=202520&pageOffset=0&pageMaxSize=5')

  // USJ (Université Saint-Joseph) public schedule
  await probe('USJ public schedule', 'https://www.usj.edu.lb/facultes-et-ecoles')

  // Reachability check
  await probe('AUB main site', 'https://www.aub.edu.lb')
  await probe('LAU main site', 'https://www.lau.edu.lb')
}

main().catch(console.error)
