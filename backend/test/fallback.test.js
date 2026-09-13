/**
 * Fallback test suite — the out-of-scope official-source safety net.
 *
 * All network access is stubbed (globalThis.fetch is swapped per test), so
 * the suite is hermetic: no test ever touches the real internet. The stub
 * records every URL the module requests, which also proves the whitelist
 * guarantee: nothing outside data/trusted_sources.json is ever fetched.
 *
 * Run:  npm test   (from backend/)
 */

const test = require("node:test");
const assert = require("node:assert");

const mockProvider = require("../src/services/providers/mock");
const classification = require("../src/services/classification");
const TRUSTED_SOURCES = require("../src/data/trusted_sources.json");

const { GENERIC_DESCRIBE_QUESTION } = classification;

const WHITELIST_HOSTS = new Set(
  TRUSTED_SOURCES.map((s) => new URL(s.url).hostname.toLowerCase().replace(/^www\./, ""))
);

// ---------------------------------------------------------------------------
// Fetch stub
// ---------------------------------------------------------------------------

const SEARCH_PAGE = `
<html><body>
<h1>Search | Punjab Police</h1>
<ol class="search-results">
<li><a href="/node/111">Rape case of a woman in Lahore: accused arrested</a></li>
<li><a href="https://punjabpolice.gov.pk/node/112">IG Punjab notice of gang rape incident in Jhelum</a></li>
</ol>
</body></html>`;

const NODE_PAGE = `
<html><body>
<h1>IG Punjab took notice of the rape incident of a female student in Muzaffargarh.</h1>
<p>IG Punjab Dr. Usman Anwar took notice of the rape incident of a female student in Muzaffargarh. The rape incident was reported to the local police station and IGP Punjab sought a report from RPO DG Khan.</p>
</body></html>`;

const FOSPAH_PAGE = `
<html><body>
<h1>FOSPAH — Federal Ombudsperson Secretariat for Protection against Harassment</h1>
<p>FOSPAH receives and decides harassment complaints under the Protection against Harassment at the Workplace Act 2010.</p>
</body></html>`;

/**
 * Recording fetch stub. `pages` maps URL substrings to canned HTML;
 * `opts.redirectSearchTo` makes every search request a 302 redirect;
 * `opts.failHosts` makes matching hosts throw (simulates network failure).
 */
function makeFetch(pages = {}, opts = {}) {
  const requested = [];
  const fn = async (url) => {
    const urlStr = String(url);
    requested.push(urlStr);
    const u = new URL(urlStr);

    if (opts.failHosts && opts.failHosts.includes(u.hostname.replace(/^www\./, ""))) {
      throw new Error("simulated network failure");
    }
    if (opts.redirectSearchTo && u.pathname.startsWith("/search")) {
      return new Response(null, { status: 302, headers: { location: opts.redirectSearchTo } });
    }
    for (const [needle, html] of Object.entries(pages)) {
      if (urlStr.includes(needle)) {
        return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
      }
    }
    return new Response("<html><body>Nothing relevant here.</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  fn.requested = requested;
  return fn;
}

async function withStubbedFetch(fetchStub, fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  try {
    return await fn(fetchStub);
  } finally {
    globalThis.fetch = realFetch;
  }
}

function assertOnlyWhitelistedHostsWereFetched(requested) {
  for (const url of requested) {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    assert.ok(
      WHITELIST_HOSTS.has(host),
      `fetched a non-whitelisted host: ${host} (${url})`
    );
  }
}

// ---------------------------------------------------------------------------
// Verify case 1: a sexual-assault description
// ---------------------------------------------------------------------------

test("sexual assault description -> fallback (not Harassment/Criminal Intimidation), citation + helplines, no draft", async () => {
  await withStubbedFetch(
    makeFetch({
      "/search/node/": SEARCH_PAGE,
      "/node/111": NODE_PAGE,
      "fospah.gov.pk": FOSPAH_PAGE,
    }),
    async (fetchStub) => {
      // the classification engine itself must NOT force a curated category
      const engine = classification.analyzeConversation({
        text: "Someone raped me last week near my house",
        conversation: [],
      });
      assert.strictEqual(engine.category, null);

      const r = await mockProvider.analyze("Someone raped me last week near my house", "auto", {
        conversation: [],
      });

      assert.strictEqual(r.category, null, "must not be force-classified");
      assert.strictEqual(r.disambiguation, null);
      assert.strictEqual(r.confidence, "none");
      assert.strictEqual(r.message_hint, "fallback");
      assert.strictEqual(r.needs_follow_up, true);

      // never a draft or legal reference through this path
      assert.strictEqual(r.draft, null);
      assert.deepStrictEqual(r.legal_references, []);
      assert.deepStrictEqual(r.next_steps, []);

      // cites a real official source (name + link)
      assert.ok(r.message.includes("Punjab Police"), "must name the official source");
      assert.ok(r.message.includes("https://punjabpolice.gov.pk/node/111"), "must link the source");
      assert.ok(r.message.includes("quoted word-for-word"), "must mark it as a direct quote");
      assert.ok(r.message.length > 0);
      assert.strictEqual(r.sources.length, 1);
      assert.strictEqual(r.sources[0].id, "punjab_police");
      assert.strictEqual(r.sources[0].source_type, "government");

      // the three verified helplines are surfaced for safety topics
      for (const line of [
        "Police emergency: 15",
        "Madadgaar National Helpline: 1098",
        "Ministry of Human Rights helpline: 1099",
      ]) {
        assert.ok(r.message.includes(line), `helpline missing: ${line}`);
      }

      // the standard disclaimer stays visible
      assert.ok(
        r.message.includes(
          "Insaaf Aasan provides general legal information only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation."
        )
      );

      // whitelist guarantee: every requested URL is a trusted_sources.json host
      assert.ok(fetchStub.requested.length > 0, "the fallback must actually search");
      assertOnlyWhitelistedHostsWereFetched(fetchStub.requested);
    }
  );
});

test("Roman Urdu and Urdu script sexual-assault descriptions also reach the fallback", async () => {
  await withStubbedFetch(
    makeFetch({ "/search/node/": SEARCH_PAGE, "/node/111": NODE_PAGE }),
    async (fetchStub) => {
      for (const text of ["Meri ziyadti ho gayi hai", "میرے سے زیادتی ہوئی ہے"]) {
        const r = await mockProvider.analyze(text, "auto", { conversation: [] });
        assert.strictEqual(r.message_hint, "fallback", `'${text}' must reach the fallback`);
        assert.strictEqual(r.category, null);
        assert.strictEqual(r.draft, null);
        assert.ok(r.message.includes("1098"), "helplines must be surfaced");
      }
      assertOnlyWhitelistedHostsWereFetched(fetchStub.requested);
    }
  );
});

// ---------------------------------------------------------------------------
// Verify case 1 (negative): honesty when nothing relevant is found
// ---------------------------------------------------------------------------

test("nothing citable on the whitelist -> helpful next steps, no fabricated reference, no failure framing", async () => {
  await withStubbedFetch(makeFetch({ "/search/node/": SEARCH_PAGE, "/node/111": NODE_PAGE }), async () => {
    const r = await mockProvider.analyze(
      "Mera zameen ka masla hai, qabza ho gaya hai",
      "auto",
      { conversation: [] }
    );

    assert.strictEqual(r.message_hint, "fallback");
    assert.strictEqual(r.draft, null);
    // honesty: nothing is cited that was not actually found
    assert.deepStrictEqual(r.sources, []);
    assert.deepStrictEqual(r.legal_references, []);
    // helpful tone: practical guidance is still offered…
    assert.ok(r.message.includes("Here is what may help"), "must lead with practical guidance");
    assert.ok(r.message.includes("Next steps:"));
    // …and the discouraging failure framing is gone
    for (const banned of ["could not find anything", "I will not guess", "I could not find"]) {
      assert.ok(!r.message.includes(banned), `must not say: "${banned}"`);
    }
    assert.ok(!r.message.includes("1098"), "helplines are reserved for personal-safety topics");
  });
});

test("all sources unreachable -> sources mentioned as temporarily unavailable, helplines still shown for safety topics", async () => {
  await withStubbedFetch(
    makeFetch({}, { redirectSearchTo: "https://evil.example.com/steal", failHosts: ["fospah.gov.pk"] }),
    async (fetchStub) => {
      const r = await mockProvider.analyze("I was raped by someone I know", "auto", {
        conversation: [],
      });

      assert.strictEqual(r.message_hint, "fallback");
      assert.strictEqual(r.draft, null);
      assert.ok(r.message.includes("not reachable"), "must mention the sources are temporarily unavailable");
      assert.ok(
        !r.message.includes("could not find anything"),
        "no failure framing even when the sources are down"
      );
      assert.ok(r.message.includes("1099"), "helplines do not depend on fetch success");

      // the off-whitelist redirect target must never be requested
      assert.ok(
        !fetchStub.requested.some((u) => u.includes("evil.example.com")),
        "a redirect off the whitelist must never be followed"
      );
      assertOnlyWhitelistedHostsWereFetched(fetchStub.requested);
    }
  );
});

// ---------------------------------------------------------------------------
// Verify case 2: curated categories behave exactly as before
// ---------------------------------------------------------------------------

test("curated category messages are completely unaffected (no fetch, same hints)", async () => {
  await withStubbedFetch(makeFetch({}), async (fetchStub) => {
    const r = await mockProvider.analyze("Mera phone chori ho gaya", "auto", { conversation: [] });
    assert.strictEqual(r.category?.id, "theft");
    assert.strictEqual(r.confidence, "high");
    assert.strictEqual(r.message_hint, "confirm_first");
    assert.strictEqual(r.needs_follow_up, true);
    assert.strictEqual(r.draft, null);
    assert.strictEqual(fetchStub.requested.length, 0, "curated path must not touch the network");
  });
});

test("vague messages still get the plain clarifying question (no fallback, no fetch)", async () => {
  await withStubbedFetch(makeFetch({}), async (fetchStub) => {
    for (const text of ["bohat paresan hoon", "kuch masla hai mujhe"]) {
      const r = await mockProvider.analyze(text, "auto", { conversation: [] });
      assert.strictEqual(r.category, null);
      assert.strictEqual(r.follow_up_questions[0], GENERIC_DESCRIBE_QUESTION);
      assert.strictEqual(r.message_hint, "clarify");
    }
    assert.strictEqual(fetchStub.requested.length, 0);
  });
});

test("a curated problem can still be adopted after a fallback reply", async () => {
  await withStubbedFetch(makeFetch({}), async (fetchStub) => {
    const r1 = await mockProvider.analyze("Someone raped me last week", "auto", { conversation: [] });
    assert.strictEqual(r1.message_hint, "fallback");
    const fetchesAfterFirst = fetchStub.requested.length;

    const conversation = [
      { role: "user", content: "Someone raped me last week" },
      { role: "assistant", content: r1.message },
    ];
    const r2 = await mockProvider.analyze("mera phone bhi chori ho gaya tha", "auto", {
      conversation,
    });
    assert.strictEqual(r2.category?.id, "theft");
    assert.strictEqual(r2.message_hint, "confirm_first");
    assert.strictEqual(
      fetchStub.requested.length,
      fetchesAfterFirst,
      "curated intake must not re-search"
    );
  });
});

// ---------------------------------------------------------------------------
// Once per topic: follow-up turns and topic switches
// ---------------------------------------------------------------------------

test("a follow-up to a handled out-of-scope topic does not search again", async () => {
  await withStubbedFetch(
    makeFetch({ "/search/node/": SEARCH_PAGE, "/node/111": NODE_PAGE }),
    async (fetchStub) => {
      const conversation = [];
      const r1 = await mockProvider.analyze("Someone raped me last week", "auto", {
        conversation: [],
      });
      assert.strictEqual(r1.message_hint, "fallback");
      conversation.push(
        { role: "user", content: "Someone raped me last week" },
        { role: "assistant", content: r1.message }
      );

      const fetchesAfterFirst = fetchStub.requested.length;
      const r2 = await mockProvider.analyze("what should I do now?", "auto", { conversation });
      assert.strictEqual(r2.message_hint, "fallback_followup");
      assert.strictEqual(r2.draft, null);
      assert.ok(r2.message.includes("1098"), "safety helplines are repeated");
      assert.ok(r2.message.includes("already searched"));
      assert.strictEqual(
        fetchStub.requested.length,
        fetchesAfterFirst,
        "the same topic must not be searched twice"
      );
    }
  );
});

test("a different out-of-scope topic in the same conversation is searched afresh", async () => {
  await withStubbedFetch(
    makeFetch({ "/search/node/": SEARCH_PAGE, "/node/111": NODE_PAGE }),
    async (fetchStub) => {
      const r1 = await mockProvider.analyze("Someone raped me last week", "auto", {
        conversation: [],
      });
      const conversation = [
        { role: "user", content: "Someone raped me last week" },
        { role: "assistant", content: r1.message },
      ];

      const fetchesAfterFirst = fetchStub.requested.length;
      const r2 = await mockProvider.analyze(
        "alag masla hai: mera zameen ka qabza ho gaya hai",
        "auto",
        { conversation }
      );
      assert.strictEqual(r2.message_hint, "fallback", "a new topic gets a fresh search");
      assert.ok(fetchStub.requested.length > fetchesAfterFirst);
      assert.ok(!r2.message.includes("1098"), "land disputes are not a safety topic");
    }
  );
});

// ---------------------------------------------------------------------------
// Whitelist enforcement
// ---------------------------------------------------------------------------

test("no domain outside trusted_sources.json is ever fetched", async () => {
  await withStubbedFetch(
    makeFetch(
      { "/search/node/": SEARCH_PAGE, "/node/111": NODE_PAGE, "fospah.gov.pk": FOSPAH_PAGE },
      {
        // an off-whitelist lure linked from a search page must never be fetched
        redirectSearchTo: undefined,
      }
    ),
    async (fetchStub) => {
      const r = await mockProvider.analyze("I was sexually assaulted at work", "auto", {
        conversation: [],
      });
      assert.strictEqual(r.message_hint, "fallback");
      assert.ok(fetchStub.requested.length > 0);
      assertOnlyWhitelistedHostsWereFetched(fetchStub.requested);
    }
  );
});

// ---------------------------------------------------------------------------
// Helpful, non-restrictive out-of-scope replies (never "eight categories")
// ---------------------------------------------------------------------------

const RENTAL_SEARCH_PAGE = `
<html><body>
<ol class="search-results">
<li><a href="/node/210">Guidance on rent and security deposit disputes for tenants</a></li>
</ol>
</body></html>`;

const RENTAL_PAGE = `
<html><body>
<h1>Tenant and landlord disputes over rent and security deposit</h1>
<p>A tenant who has paid a security deposit to the landlord may recover the security deposit through the rent authority when the tenancy ends.</p>
</body></html>`;

test("landlord deposit reply follows the helpful official-source style", async () => {
  await withStubbedFetch(
    makeFetch({ "/search/node/rental": RENTAL_SEARCH_PAGE, "/node/210": RENTAL_PAGE }),
    async (fetchStub) => {
      const r = await mockProvider.analyze("My landlord isn't returning my deposit.", "auto", {
        conversation: [],
      });

      assert.strictEqual(r.message_hint, "fallback");
      assert.strictEqual(r.category, null);
      assert.strictEqual(r.draft, null);

      // the requested response style
      assert.ok(r.message.includes("Thank you for explaining your situation"), "must thank the user");
      assert.ok(
        r.message.includes(
          "I'll check the relevant Pakistani laws and official guidance for rental and security-deposit matters"
        ),
        "must say what will be checked"
      );
      assert.ok(
        r.message.includes("Based on the official information I found, here is what may apply:"),
        "must lead into the official finding"
      );
      assert.ok(r.message.includes("Next steps:"), "must include practical next steps");
      assert.ok(
        r.message.includes("Official source:\nPunjab Police — https://punjabpolice.gov.pk/node/210"),
        "must cite the official source with its link"
      );
      assert.ok(
        r.message.includes(
          "The exact legal position can depend on your rental agreement and the facts of your case"
        ),
        "must state fact-dependence"
      );
      assert.strictEqual(r.sources.length, 1);
      assert.strictEqual(r.sources[0].id, "punjab_police");

      assertOnlyWhitelistedHostsWereFetched(fetchStub.requested);
    }
  );
});

test("out-of-scope replies never use restrictive phrasing", async () => {
  await withStubbedFetch(makeFetch({}), async () => {
    const cases = [
      "My landlord isn't returning my deposit.",
      "Mera zameen ka masla hai, qabza ho gaya hai",
      "I was fired from my job without notice",
    ];
    for (const text of cases) {
      const r = await mockProvider.analyze(text, "auto", { conversation: [] });
      assert.strictEqual(r.message_hint, "fallback", `'${text}' must reach the fallback`);
      for (const banned of [
        "eight legal categories",
        "eight covered categories",
        "only for its eight",
        "outside our categories",
        "I can only help",
        "I cannot help",
        "cannot help with this",
        "could not find anything",
        "I could not find",
        "I will not guess",
        "I can only share",
        "I will not go beyond",
      ]) {
        assert.ok(!r.message.includes(banned), `'${text}' must not say: "${banned}"`);
      }
      assert.ok(r.message.includes("Thank you for"), "the tone must stay welcoming");
      assert.ok(r.message.includes("Next steps:"), "practical steps must always be offered");
    }
  });
});

test("an unfamiliar concrete problem gets a generic official-source lookup, not a brush-off", async () => {
  await withStubbedFetch(makeFetch({}), async (fetchStub) => {
    const r = await mockProvider.analyze("My neighbour built a wall blocking my driveway", "auto", {
      conversation: [],
    });

    assert.strictEqual(r.category, null, "must not be force-classified");
    assert.strictEqual(r.draft, null);
    assert.deepStrictEqual(r.legal_references, []);
    assert.strictEqual(r.message_hint, "fallback");
    assert.ok(r.message.includes("Thank you for explaining your situation"));
    assert.ok(r.message.includes("official guidance for you"));
    assert.ok(r.message.includes("Here is what may help"), "must lead with practical guidance");
    assert.ok(!r.message.includes("could not find anything"), "no failure framing");
    assert.ok(!r.message.includes("I will not guess"), "no failure framing");
    assert.ok(r.message.includes("Next steps:"), "must still suggest next steps");
    assert.ok(fetchStub.requested.length > 0, "the generic lookup must actually search");
    assertOnlyWhitelistedHostsWereFetched(fetchStub.requested);
  });
});

test("a generic lookup quotes the official page it found (user's own words)", async () => {
  await withStubbedFetch(
    makeFetch({ "/search/node/": SEARCH_PAGE, "/node/111": NODE_PAGE }),
    async () => {
      const r = await mockProvider.analyze(
        "The Punjab police station refused to register my student complaint",
        "auto",
        { conversation: [] }
      );
      assert.strictEqual(r.message_hint, "fallback");
      assert.strictEqual(r.sources.length, 1);
      assert.strictEqual(r.sources[0].id, "punjab_police");
      assert.ok(r.message.includes("https://punjabpolice.gov.pk/node/111"), "must link the source");
      assert.ok(r.message.includes("quoted word-for-word"), "must mark it as a direct quote");
      assert.ok(r.message.includes("Next steps:"));
    }
  );
});

test("a follow-up after a generic lookup does not search again", async () => {
  await withStubbedFetch(makeFetch({}), async (fetchStub) => {
    const r1 = await mockProvider.analyze("My neighbour built a wall blocking my driveway", "auto", {
      conversation: [],
    });
    assert.strictEqual(r1.message_hint, "fallback");
    assert.ok(fetchStub.requested.length > 0, "first message must search");

    const fetchesAfterFirst = fetchStub.requested.length;
    const conversation = [
      { role: "user", content: "My neighbour built a wall blocking my driveway" },
      { role: "assistant", content: r1.message },
    ];
    const r2 = await mockProvider.analyze("what should I do now?", "auto", { conversation });
    assert.strictEqual(r2.message_hint, "fallback_followup");
    assert.strictEqual(
      fetchStub.requested.length,
      fetchesAfterFirst,
      "a bare follow-up must not re-search"
    );
  });
});

test("an Urdu-script unfamiliar problem still gets a helpful reply (no blind search)", async () => {
  await withStubbedFetch(makeFetch({}), async (fetchStub) => {
    const r = await mockProvider.analyze("میرے پڑوسی نے میری گاڑی کھرچ دی ہے", "auto", {
      conversation: [],
    });
    assert.strictEqual(r.category, null);
    assert.strictEqual(r.message_hint, "fallback");
    assert.ok(r.message.includes("Thank you for explaining your situation"));
    assert.ok(r.message.includes("Here is what may help"), "must lead with practical guidance");
    assert.ok(!r.message.includes("could not find anything"), "no failure framing");
    // no Latin words to build a search query -> no fetch is attempted
    assert.strictEqual(fetchStub.requested.length, 0, "must not search blindly");
  });
});
