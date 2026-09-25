/**
 * The niche definition. Single source of truth for what "rare-earth-free magnet" means to us.
 * Rationale and CPC verification live in docs/research/03-patent-data-sources.md.
 */
export const NICHE = {
  // CPC prefixes that are on-topic on their own (magnet materials that are not rare-earth alloys).
  cpcInclude: [
    "H01F1/047", // hard magnetic materials, metals/alloys (non-RE)  — needs keyword co-filter
    "H01F1/06",  // hard magnetic metals or alloys
    "H01F1/08",  // hard magnetic materials, ferrites/oxides
    "H01F1/10",  // hard ferrites, general
    "H01F1/11",  // hard ferrites, particles
    "H01F1/113", // hard ferrite, characterised by composition
    "C04B35/26", // ferrite ceramics (Fe2O3 based)
    "C01G49/00", // iron compounds (incl. nitrides via C01B21/06)
    "C01B21/06", // metal nitrides (iron nitride)
    "C22C22/00", // manganese-based alloys (MnBi, MnAl)
    "C04B35/2683", // hexaferrites containing alkaline earth (Ba/Sr)
    "C22C38/001", // ferrous alloys containing N (Fe16N2) — noisy, keyword co-filter applies
    "C22C38/08",  // ferrous alloys containing Ni (L10 FeNi) — noisy, keyword co-filter applies
    "C22C2202/02", // indexing code: hard magnetic materials
    "H02K19/10", // synchronous reluctance machines (RE-free motor topologies)
    "H02K1/246", // rotors with flux barriers (SynRM)
    "H02K1/27",  // PM rotor cores — kept only with ferrite / RE-free keyword
  ],
  // CPC groups that identify rare-earth alloy magnets. Hits here are only kept if they ALSO match
  // an RE-free / RE-lean keyword (to capture "reduced dysprosium", "Ce-substituted" work).
  cpcRareEarth: ["H01F1/053", "H01F1/055", "H01F1/057", "H01F1/058", "H01F1/059"],
  // Keyword phrases (case-insensitive) searched in title + abstract (+ claims where available).
  keywords: [
    "iron nitride", "Fe16N2", "α''-Fe16N2", "alpha''-Fe16N2", "MnBi", "manganese bismuth",
    "MnAl", "manganese aluminium", "manganese aluminum", "tau-phase", "τ-MnAl",
    "tetrataenite", "L10 FeNi", "L1 0 FeNi", "FeNi L10",
    "hexaferrite", "strontium ferrite", "barium ferrite", "La-Co ferrite", "lanthanum cobalt ferrite",
    "rare earth free", "rare-earth-free", "free of rare earth", "without rare earth", "rare earth-free",
    "rare-earth-lean", "rare earth lean", "reduced dysprosium", "dysprosium-free", "heavy rare earth free",
    "cerium magnet", "Ce-substituted", "cerium-substituted", "cerium substituted", "Ce-Fe-B", "La-Ce", "Dy-free",
    "Fe8N", "α″-Fe16N2", "Mn-Al-C", "tau phase", "τ-phase", "L1₀-FeNi", "FeNi ordered", "La-Co substituted",
    "magnet-free motor", "magnetless", "synchronous reluctance",
  ],
  // Terms that, when present with a rare-earth CPC and no RE-free keyword, indicate noise.
  // Sm2Fe17Nx is a rare-earth *nitride* (H01F1/059): the "nitride trap". It never counts as iron nitride.
  noise: ["NdFeB", "Nd2Fe14B", "neodymium iron boron", "neodymium", "samarium cobalt", "SmCo", "Sm2Fe17", "samarium", "grain boundary diffusion"],
  buckets: {
    iron_nitride: ["iron nitride", "fe16n2"],
    mnbi: ["mnbi", "manganese bismuth"],
    mnal: ["mnal", "manganese alumin", "tau-phase", "τ-mnal"],
    feni_l10: ["tetrataenite", "l10 feni", "feni l10", "l1 0 feni"],
    ferrite: ["ferrite"],
    re_lean: ["rare-earth-lean", "rare earth lean", "reduced dysprosium", "dysprosium-free", "dy-free", "heavy rare earth free", "cerium", "ce-substituted", "ce-fe-b", "la-ce"],
    motor_topology: ["reluctance", "wound rotor", "flux barrier", "induction motor", "magnet-free", "magnetless"],
  } as Record<string, string[]>,
};

export function matchTerms(text: string): string[] {
  const t = text.toLowerCase();
  return NICHE.keywords.filter((k) => t.includes(k.toLowerCase()));
}

export function isRareEarthCpc(code: string): boolean {
  return NICHE.cpcRareEarth.some((p) => code.startsWith(p));
}

export function isIncludedCpc(code: string): boolean {
  return NICHE.cpcInclude.some((p) => code.startsWith(p));
}

/**
 * Relevance decision. Returns matched terms if the record is on-topic, else null.
 * Rule: (RE-free keyword) OR (included CPC AND not (RE CPC without RE-free keyword) AND not pure noise).
 */
export function classify(pub: { title?: string | null; abstract?: string | null; cpc_codes: string[] }): string[] | null {
  const text = `${pub.title ?? ""} \n ${pub.abstract ?? ""}`;
  const terms = matchTerms(text);
  const hasRe = pub.cpc_codes.some(isRareEarthCpc);
  const hasInc = pub.cpc_codes.some(isIncludedCpc);
  const lower = text.toLowerCase();
  const noisy = NICHE.noise.some((n) => lower.includes(n.toLowerCase()));
  const reFreeTerm = terms.some((k) => /rare|dysprosium|dy-free|cerium|ce-sub|ce-fe-b|la-ce/i.test(k));
  if (reFreeTerm) return terms;
  if (hasRe && !reFreeTerm) return null; // RE alloy patent that does not claim RE-free/lean
  if (terms.length > 0 && !noisy) return terms;
  if (hasInc && !noisy && terms.length > 0) return terms;
  return null;
}

export function bucketFor(terms: string[], cpcs: string[]): string {
  const t = terms.join(" ").toLowerCase();
  for (const [bucket, needles] of Object.entries(NICHE.buckets)) {
    if (needles.some((n) => t.includes(n))) return bucket;
  }
  if (cpcs.some((c) => c.startsWith("H01F1/08") || c.startsWith("H01F1/1") || c.startsWith("C04B35/26"))) return "ferrite";
  if (cpcs.some((c) => c.startsWith("H02K"))) return "motor_topology";
  return "other";
}
