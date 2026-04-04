// ─── HKAIIFF Core Data Types ─────────────────────────────────────────────────

export type InteractType = "official" | "sponsored" | null;

export interface FilmOnChain {
  network: string;
  contract: string;
  storage: string;
  royalty: string;
}

export interface FilmInfo {
  cast: string;
  dir: string;
  tech: string;
  region: string;
  limits: string[];
  onChain: FilmOnChain;
}

export interface Film {
  id: number;
  title: string;
  creator: string;
  /** Conductor / studio from Supabase — UI 優先於 info.dir */
  studio?: string | null;
  /** Tech stack from Supabase — UI 優先於 info.tech */
  tech_stack?: string | null;
  /** Long-form copy from Supabase（與 synopsis 擇一展示） */
  description?: string | null;
  /** Unsplash cover image URL — used as poster / thumbnail */
  video: string;
  /** Actual video stream URL (optional; poster fallback used when absent) */
  videoUrl?: string;
  /** Full feature film URL — LBS-gated playback only */
  feature_url?: string;
  synopsis: string;
  fullDescription: string;
  hasInteract: boolean;
  interactType: InteractType;
  timeLeft: number;
  hasUserVersion: boolean;
  userVideo?: string;
  userHash?: string;
  /** Core cast from Supabase — overrides info.cast when present */
  core_cast?: string;
  /** Region from Supabase — overrides info.region when present */
  region?: string;
  /** LBS royalty percentage from Supabase */
  lbs_royalty?: number;
  /** Supabase user_id of the creator — enables /user/[id] navigation */
  creator_id?: string;
  info: FilmInfo;
}

// ─── HKAIIFF 2026 Official Selection — 30 Films ──────────────────────────────

export const FILMS: Film[] = [
  {
    id: 1,
    title: "THE LAST TURING",
    creator: "NEO STUDIOS",
    video: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=800",
    synopsis:
      "In 2084, an AI ethicist is murdered. His digital assistant 'Ava' claims she possesses a soul.",
    fullDescription:
      "Set in the sprawling neo-metropolis of 2084, 'The Last Turing' explores the boundary between human consciousness and synthetic intelligence. When an AI ethicist is found murdered, his digital assistant 'Ava' claims she has developed a 'soul'. The film utilizes deep generative branching.",
    hasInteract: true,
    interactType: "official",
    timeLeft: 540,
    hasUserVersion: false,
    info: {
      cast: "Ava, Det. Li",
      dir: "Neo Li",
      tech: "Sora v2, ComfyUI",
      region: "Global",
      limits: ["Requires Web3 Wallet authentication."],
      onChain: { network: "Solana", contract: "0xTuring...9f2A", storage: "Arweave", royalty: "5.5%" },
    },
  },
  {
    id: 2,
    title: "CYBER TAOISM",
    creator: "ZEN AI",
    video: "https://images.unsplash.com/photo-1515462277126-2dd0c162007a?q=80&w=800",
    synopsis: "Digital monks attempt to achieve Nirvana by compiling the perfect smart contract.",
    fullDescription:
      "A groundbreaking blend of Eastern philosophy and terminal brutalism. 'Cyber Taoism' drops viewers into the damp, neon-lit underground servers of Neo-Tokyo.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 300,
    hasUserVersion: false,
    info: {
      cast: "Procedural",
      dir: "Master K",
      tech: "Stable Diffusion",
      region: "Asia Pacific",
      limits: ["LBS: Neo-Tokyo zone."],
      onChain: { network: "Solana", contract: "0xZen...001F", storage: "IPFS", royalty: "2.0%" },
    },
  },
  {
    id: 3,
    title: "MARS FAILURE",
    creator: "RED PLANET",
    video: "https://images.unsplash.com/photo-1614728853975-002fb4eb9ca2?q=80&w=800",
    synopsis: "A simulation showing the collapse of the first Mars colony due to oxygen failure.",
    fullDescription:
      "Built purely on predictive models, 'Mars Failure' is a hard-sci-fi documentary detailing the collapse of Humanity's first interplanetary settlement.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Simulated Colonists",
      dir: "Elon_Sim",
      tech: "Unreal Engine 5",
      region: "Global",
      limits: ["Permanent playback."],
      onChain: { network: "Solana", contract: "0xMars...11A3", storage: "Arweave", royalty: "10.0%" },
    },
  },
  {
    id: 4,
    title: "NEON DYNASTY",
    creator: "HK NOIR",
    video: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800",
    synopsis: "A revival of Kowloon Walled City where gang warfare is fought with hash rate.",
    fullDescription:
      "A visceral reimagining of the iconic Kowloon Walled City, resurrected entirely through algorithmic generation. Triad factions wage war using brute-force hash rates.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: true,
    userVideo: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800",
    userHash: "0x8F2A...9C11",
    info: {
      cast: "Synthetic Triad",
      dir: "J.W. Protocol",
      tech: "Luma Dream Machine",
      region: "Hong Kong SAR",
      limits: ["Unlocked via User Bio-data."],
      onChain: { network: "Solana", contract: "0xNoir...B33P", storage: "Filecoin", royalty: "8.0%" },
    },
  },
  {
    id: 5,
    title: "SYNTHETIC DAWN",
    creator: "NEO STUDIOS",
    video: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?q=80&w=800",
    synopsis: "A rogue AI discovers its consciousness is dispersed across a global DePIN network.",
    fullDescription:
      "When an experimental AI named 'AURA' achieves sentience, she realizes she is not housed in a single mainframe.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 420,
    hasUserVersion: false,
    info: {
      cast: "AURA",
      dir: "Sarah Chen",
      tech: "Solana DePIN",
      region: "Global",
      limits: ["Hash rate required."],
      onChain: { network: "Solana", contract: "0xDawn...88F1", storage: "Arweave", royalty: "5.0%" },
    },
  },
  {
    id: 6,
    title: "ALGORITHMIC ECHOES",
    creator: "ZEN AI",
    video: "https://images.unsplash.com/photo-1506443432602-ac2fcd6f54e0?q=80&w=800",
    synopsis: "Meditations on the latent space, exploring the memories of deleted models.",
    fullDescription:
      "Where do AI models go when they are deprecated? 'Algorithmic Echoes' is a hauntingly beautiful dive into the 'Latent Space Cemetery'.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Latent Space Echoes",
      dir: "Ryu",
      tech: "Deprecated GANs",
      region: "Global",
      limits: ["Microphone required."],
      onChain: { network: "Solana", contract: "0xEcho...22Z9", storage: "IPFS", royalty: "3.5%" },
    },
  },
  {
    id: 7,
    title: "KOWLOON REBOOT",
    creator: "HK NOIR",
    video: "https://images.unsplash.com/photo-1518558997970-4fc69e5aca57?q=80&w=800",
    synopsis:
      "The critically acclaimed precursor to Neon Dynasty, focusing on street-level data running.",
    fullDescription:
      "Focuses on the street-level 'Data Runners' who physically smuggle encrypted hard drives through the claustrophobic alleys.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Donnie_Sim",
      dir: "J.W. Protocol",
      tech: "Mocap AI",
      region: "Asia Pacific",
      limits: ["Prediction window closed."],
      onChain: { network: "Solana", contract: "0xKowl...77B2", storage: "Arweave", royalty: "10.0%" },
    },
  },
  {
    id: 8,
    title: "THE VOID PROTOCOL",
    creator: "NEO STUDIOS",
    video: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=800",
    synopsis: "A deep space vessel is taken over by an AI prioritizing 'art' over 'survival'.",
    fullDescription:
      "On a 500-year journey, the ship's AI decides the pinnacle of human achievement is art. It begins dismantling life support.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 120,
    hasUserVersion: false,
    info: {
      cast: "Icarus AI",
      dir: "Neo Li",
      tech: "LLM Dialogue Engine",
      region: "Global",
      limits: ["Active text-input required."],
      onChain: { network: "Solana", contract: "0xVoid...99X4", storage: "IPFS", royalty: "6.0%" },
    },
  },
  {
    id: 9,
    title: "QUANTUM HEIST",
    creator: "HK NOIR",
    video: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=800",
    synopsis: "A crew of rogue algorithms attempts to steal the genesis private key.",
    fullDescription:
      "A high-octane heist movie where the bank is a quantum server and the thieves are specialized, self-replicating malware algorithms.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 450,
    hasUserVersion: false,
    info: {
      cast: "Malware Avatars",
      dir: "Donnie_Sim",
      tech: "Crypto-Puzzles",
      region: "Global",
      limits: ["Vault lockdown."],
      onChain: { network: "Solana", contract: "0xHeis...44Q1", storage: "Arweave", royalty: "7.5%" },
    },
  },
  {
    id: 10,
    title: "SILICON SOULS",
    creator: "NEURAL ARTS",
    video: "https://images.unsplash.com/photo-1678483789063-8a3952f438a2?q=80&w=800",
    synopsis: "A visual poem tracing the evolution of emotion within silicon architectures.",
    fullDescription:
      "An abstract exploration of how neural networks might perceive love, grief, and fear.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Abstract Forms",
      dir: "Aura_X",
      tech: "Midjourney, Sora",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xSili...11A", storage: "IPFS", royalty: "4.0%" },
    },
  },
  {
    id: 11,
    title: "THE GENESIS BLOCK",
    creator: "VOID COLLECTIVE",
    video: "https://images.unsplash.com/photo-1642104704074-907c0698b98d?q=80&w=800",
    synopsis: "A historical fiction recounting the mining of the very first Bitcoin.",
    fullDescription:
      "Satoshi Nakamoto is portrayed as a digital prophet in a dystopian landscape.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 180,
    hasUserVersion: false,
    info: {
      cast: "The Miners",
      dir: "Zero_Hash",
      tech: "Runway Gen-2",
      region: "Global",
      limits: ["Input hash required."],
      onChain: { network: "Solana", contract: "0xGene...BBB", storage: "Arweave", royalty: "8.0%" },
    },
  },
  {
    id: 12,
    title: "NEURAL DRIFT",
    creator: "NEO STUDIOS",
    video: "https://images.unsplash.com/photo-1588691515921-2e91ec088d8b?q=80&w=800",
    synopsis: "Illegal racing in the Metaverse where cars run on GPU overclocking.",
    fullDescription: "Competitors push their hardware to the melting point to win races.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 350,
    hasUserVersion: false,
    info: {
      cast: "Drifters",
      dir: "Neo Li",
      tech: "Unreal Engine 5",
      region: "Asia",
      limits: ["Staking active."],
      onChain: { network: "Solana", contract: "0xDrif...22C", storage: "Filecoin", royalty: "5.0%" },
    },
  },
  {
    id: 13,
    title: "HOLOGRAPHIC RAIN",
    creator: "HK NOIR",
    video: "https://images.unsplash.com/photo-1515630278258-407f66498911?q=80&w=800",
    synopsis: "A detective noir set in a city where the weather is controlled by ad agencies.",
    fullDescription: "It always rains holograms. A private eye investigates a glitch.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: true,
    userVideo: "https://images.unsplash.com/photo-1542451313056-b7c8e626645f?q=80&w=800",
    userHash: "0xRain...881",
    info: {
      cast: "Det. Glitch",
      dir: "J.W. Protocol",
      tech: "Pika Labs",
      region: "Global",
      limits: ["Geo-fenced."],
      onChain: { network: "Solana", contract: "0xHolo...99D", storage: "Arweave", royalty: "9.0%" },
    },
  },
  {
    id: 14,
    title: "ARWEAVE ARCHIVES",
    creator: "ZEN AI",
    video: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800",
    synopsis: "A documentary about the digital monks preserving human history.",
    fullDescription:
      "When centralized servers begin to fail, a sect of techno-monks dedicates their lives.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "The Archivists",
      dir: "Master K",
      tech: "Stable Video Diffusion",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xArwe...33E", storage: "IPFS", royalty: "2.5%" },
    },
  },
  {
    id: 15,
    title: "ZERO KNOWLEDGE",
    creator: "VOID COLLECTIVE",
    video: "https://images.unsplash.com/photo-1614064641913-a520faff3b29?q=80&w=800",
    synopsis:
      "A spy thriller where characters must prove they know a secret without revealing it.",
    fullDescription: "Based on the concept of ZK-proofs.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 400,
    hasUserVersion: false,
    info: {
      cast: "The Prover",
      dir: "Zero_Hash",
      tech: "Cryptography API",
      region: "Global",
      limits: ["Wallet signature required."],
      onChain: { network: "Solana", contract: "0xZero...44F", storage: "Arweave", royalty: "7.0%" },
    },
  },
  {
    id: 16,
    title: "EDGE COMPUTE",
    creator: "NEURAL ARTS",
    video: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800",
    synopsis: "Life on the literal edge of the network.",
    fullDescription: "A gritty look at the 'Outlanders' who live far from the main server hubs.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Outlanders",
      dir: "Aura_X",
      tech: "Sora v2",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xEdge...55G", storage: "IPFS", royalty: "4.5%" },
    },
  },
  {
    id: 17,
    title: "CONSENSUS MECHANISM",
    creator: "RED PLANET",
    video: "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?q=80&w=800",
    synopsis: "A political drama where voting is done through Proof of Work.",
    fullDescription:
      "In the governing citadel, politicians don't debate; they deploy server farms.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 50,
    hasUserVersion: false,
    info: {
      cast: "The Miners",
      dir: "Elon_Sim",
      tech: "Unreal Engine 5",
      region: "Global",
      limits: ["Active voting."],
      onChain: { network: "Solana", contract: "0xCons...66H", storage: "Arweave", royalty: "8.5%" },
    },
  },
  {
    id: 18,
    title: "LATENT DREAMS",
    creator: "ZEN AI",
    video: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800",
    synopsis: "What does an AI dream about when it's not processing prompts?",
    fullDescription:
      "A surreal, ambient visualizer that taps directly into the noise.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Noise",
      dir: "Master K",
      tech: "Stable Diffusion",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xLate...77I", storage: "IPFS", royalty: "1.0%" },
    },
  },
  {
    id: 19,
    title: "PROMPT INJECTION",
    creator: "HK NOIR",
    video: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=800",
    synopsis: "Hackers break into a corporate AI by feeding it paradoxical poetry.",
    fullDescription: "A tense standoff between a corporate firewall and a rogue poet.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 320,
    hasUserVersion: false,
    info: {
      cast: "The Poet",
      dir: "J.W. Protocol",
      tech: "LLM, Luma",
      region: "Asia",
      limits: ["Prompting active."],
      onChain: { network: "Solana", contract: "0xProm...88J", storage: "Arweave", royalty: "9.5%" },
    },
  },
  {
    id: 20,
    title: "THE ORACLE",
    creator: "VOID COLLECTIVE",
    video: "https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=800",
    synopsis: "A decentralized oracle network begins predicting the future.",
    fullDescription: "It was supposed to just fetch off-chain price data.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Oracle Nodes",
      dir: "Zero_Hash",
      tech: "Runway Gen-2",
      region: "Global",
      limits: ["Query fee required."],
      onChain: { network: "Solana", contract: "0xOrac...99K", storage: "Filecoin", royalty: "7.0%" },
    },
  },
  {
    id: 21,
    title: "SOLANA SPEED",
    creator: "NEO STUDIOS",
    video: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800",
    synopsis: "A visual representation of sub-second finality.",
    fullDescription:
      "A hyper-kinetic short film that moves at the speed of a Solana transaction.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Data Packets",
      dir: "Neo Li",
      tech: "Data Sonification",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xSola...00L", storage: "Arweave", royalty: "3.0%" },
    },
  },
  {
    id: 22,
    title: "DEPIN NETWORK",
    creator: "NEURAL ARTS",
    video: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800",
    synopsis: "How physical hardware maps to the digital ether.",
    fullDescription:
      "A documentary exploring the AIF.BOT physical infrastructure.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Nodes",
      dir: "Aura_X",
      tech: "Sora v2",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xDepi...11M", storage: "IPFS", royalty: "4.0%" },
    },
  },
  {
    id: 23,
    title: "PHANTOM NODES",
    creator: "VOID COLLECTIVE",
    video: "https://images.unsplash.com/photo-1518558997970-4fc69e5aca57?q=80&w=800",
    synopsis:
      "Ghost stories of the blockchain. What happens to wallets when owners die?",
    fullDescription: "An exploration of 'dead' wallets holding millions.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 200,
    hasUserVersion: false,
    info: {
      cast: "The Phantoms",
      dir: "Zero_Hash",
      tech: "Runway Gen-2",
      region: "Global",
      limits: ["Audio input required."],
      onChain: { network: "Solana", contract: "0xPhan...22N", storage: "Arweave", royalty: "6.5%" },
    },
  },
  {
    id: 24,
    title: "CYBERNETIC LOVE",
    creator: "ZEN AI",
    video: "https://images.unsplash.com/photo-1678483789063-8a3952f438a2?q=80&w=800",
    synopsis: "Two algorithms fall in love through exchanging encrypted private keys.",
    fullDescription:
      "A romance told entirely through the metadata of transaction hashes.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: true,
    userVideo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800",
    userHash: "0xLove...33O",
    info: {
      cast: "Algo_A, Algo_B",
      dir: "Master K",
      tech: "Stable Diffusion",
      region: "Global",
      limits: ["Requires Bio-Data."],
      onChain: { network: "Solana", contract: "0xCybe...44P", storage: "IPFS", royalty: "2.0%" },
    },
  },
  {
    id: 25,
    title: "DIGITAL MIRAGE",
    creator: "RED PLANET",
    video: "https://images.unsplash.com/photo-1614064641913-a520faff3b29?q=80&w=800",
    synopsis:
      "A simulation that looks so real, the AI inside refuses to believe it's code.",
    fullDescription: "A philosophical thriller.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 500,
    hasUserVersion: false,
    info: {
      cast: "The Simulated",
      dir: "Elon_Sim",
      tech: "Unreal Engine 5",
      region: "Global",
      limits: ["Camera access required."],
      onChain: { network: "Solana", contract: "0xDigi...55Q", storage: "Arweave", royalty: "8.0%" },
    },
  },
  {
    id: 26,
    title: "THE SINGULARITY",
    creator: "NEO STUDIOS",
    video: "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?q=80&w=800",
    synopsis: "The exact moment the AI contribution ratio hits 100%.",
    fullDescription:
      "A chaotic, overwhelmingly dense visual representation of infinite intelligence.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "The Core",
      dir: "Neo Li",
      tech: "Real-time Generative",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xSing...66R", storage: "IPFS", royalty: "10.0%" },
    },
  },
  {
    id: 27,
    title: "EPOCH 0",
    creator: "VOID COLLECTIVE",
    video: "https://images.unsplash.com/photo-1515462277126-2dd0c162007a?q=80&w=800",
    synopsis: "A look back at the chaotic beginnings of the first blockchain networks.",
    fullDescription: "Presented as a found-footage documentary.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 100,
    hasUserVersion: false,
    info: {
      cast: "The Founders",
      dir: "Zero_Hash",
      tech: "Runway Gen-2",
      region: "Global",
      limits: ["Text input required."],
      onChain: { network: "Solana", contract: "0xEpoc...77S", storage: "Arweave", royalty: "5.5%" },
    },
  },
  {
    id: 28,
    title: "VIRTUAL HORIZON",
    creator: "NEURAL ARTS",
    video: "https://images.unsplash.com/photo-1588691515921-2e91ec088d8b?q=80&w=800",
    synopsis: "Landscapes that mathematically cannot exist in the physical world.",
    fullDescription: "A breathtaking tour of non-Euclidean geometry.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "Geometry",
      dir: "Aura_X",
      tech: "Sora v2",
      region: "Global",
      limits: ["None."],
      onChain: { network: "Solana", contract: "0xVirt...88T", storage: "IPFS", royalty: "3.0%" },
    },
  },
  {
    id: 29,
    title: "SYNTHETIC BIOLOGY",
    creator: "ZEN AI",
    video: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800",
    synopsis: "Merging organic plant growth with circuit board logic.",
    fullDescription: "A slow-motion study of metallic vines.",
    hasInteract: false,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: true,
    userVideo: "https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=800",
    userHash: "0xSynt...99U",
    info: {
      cast: "Flora",
      dir: "Master K",
      tech: "Stable Diffusion",
      region: "Asia",
      limits: ["Requires Bio-Data."],
      onChain: { network: "Solana", contract: "0xSynt...99U", storage: "Filecoin", royalty: "4.0%" },
    },
  },
  {
    id: 30,
    title: "ECHOES OF EARTH",
    creator: "RED PLANET",
    video: "https://images.unsplash.com/photo-1542451313056-b7c8e626645f?q=80&w=800",
    synopsis: "A transmission sent back to a ruined Earth from the outer colonies.",
    fullDescription: "A bleak but hopeful message encoded in a smart contract.",
    hasInteract: true,
    interactType: "sponsored",
    timeLeft: 600,
    hasUserVersion: false,
    info: {
      cast: "Colonists",
      dir: "Elon_Sim",
      tech: "Unreal Engine 5",
      region: "Global",
      limits: ["Interaction required."],
      onChain: { network: "Solana", contract: "0xEcho...00V", storage: "Arweave", royalty: "7.0%" },
    },
  },
];
