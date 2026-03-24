# HKAIIFF Platform — Part 4: Library 工具库 & 核心前端页面
> 提交给 Claude 进行代码审查 | 共4部分之第4部分
> 本文件包含：lib/ 工具库 + 核心前端页面 + 运维脚本

## Library 工具库
### lib/supabase.ts
```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
  },
});
```

### lib/data.ts
```typescript
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
```

### lib/bunnyStream.ts
```typescript
/**
 * lib/bunnyStream.ts
 *
 * Bunny Stream 视频流服务对接工具（仅服务端调用，含密钥）
 *
 * 设计原则：
 *  - 所有 API 调用均在 Next.js API Route（服务端）中执行，密钥不暴露给浏览器。
 *  - createBunnyVideo()   → 在 Bunny 创建空视频占位符，返回 guid
 *  - uploadToBunny()      → 将本地二进制流直接 PUT 到 Bunny
 *  - fetchFromUrlToBunny()→ 让 Bunny 服务器主动拉取旧 OSS URL（一键迁移）
 *  - getBunnyHlsUrl()     → 组装 HLS 播放地址（客户端安全）
 *  - getBunnyThumbnailUrl()→ 组装缩略图地址（客户端安全）
 *
 * 环境变量（均在 .env.local 配置）：
 *  BUNNY_LIBRARY_ID    — Bunny Stream 媒体库 ID
 *  BUNNY_CDN_HOSTNAME  — Bunny CDN 分发域名（不含 https://）
 *  BUNNY_API_KEY       — Bunny Stream API 访问密钥
 */

// ─── 读取环境变量（服务端） ───────────────────────────────────────────────────

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[BunnyStream] 缺少必要环境变量: ${key}，请检查 .env.local 或 Vercel Dashboard → Settings → Environment Variables`,
    );
  }
  return value;
}

// ─── 公共请求头构建 ────────────────────────────────────────────────────────────
//
// 注意：BUNNY_API_KEY 必须是 Bunny Stream 媒体库的 API Key（Library API Key），
// 而非账号级别的 Account API Key。可在 Bunny Dashboard → Stream → 选择媒体库
// → API → Library API Key 中找到正确的密钥。

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const apiKey = getEnv('BUNNY_API_KEY');
  console.log(`[BunnyStream] buildHeaders: key prefix=${apiKey.slice(0, 6)}… length=${apiKey.length}`);
  return {
    AccessKey: apiKey,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ─── 核心 API 方法 ─────────────────────────────────────────────────────────────

/**
 * 在 Bunny Stream 媒体库中创建一个空视频占位符。
 *
 * @param title 视频标题（建议使用影片名称）
 * @returns     新视频的 Bunny guid（后续上传 / 播放均依赖此 ID）
 *
 * @example
 *   const guid = await createBunnyVideo('我的电影标题');
 */
export async function createBunnyVideo(title: string, signal?: AbortSignal): Promise<string> {
  const libraryId = getEnv('BUNNY_LIBRARY_ID');
  const url = `https://video.bunnycdn.com/library/${libraryId}/videos`;

  console.log(`[BunnyStream] createBunnyVideo 调用: title="${title}", libraryId="${libraryId}", url="${url}"`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ title }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    const data = (await res.json()) as { guid?: string };

    if (!data.guid) {
      throw new Error(`Bunny 响应中未包含 guid，响应内容: ${JSON.stringify(data)}`);
    }

    console.log(`[BunnyStream] 视频占位符创建成功，guid=${data.guid}，title="${title}"`);
    return data.guid;
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      console.error('[BunnyStream] createBunnyVideo 超时中止');
      throw new Error('Bunny Stream 请求超时（createVideo），请检查网络后重试');
    }
    console.error('[BunnyStream] createBunnyVideo 失败：', err);
    throw err;
  }
}

/**
 * 将本地二进制视频流直接上传至 Bunny Stream。
 * 适用于：用户在平台上传视频后，服务端转发二进制内容至 Bunny。
 *
 * @param guid       由 createBunnyVideo() 返回的视频 guid
 * @param fileBuffer 视频文件的 Buffer 或 Blob 数据
 *
 * @example
 *   await uploadToBunny(guid, fs.readFileSync('/tmp/video.mp4'));
 */
export async function uploadToBunny(
  guid: string,
  fileBuffer: Buffer | Blob,
  signal?: AbortSignal,
): Promise<void> {
  const libraryId = getEnv('BUNNY_LIBRARY_ID');
  const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;

  const bufferSize = fileBuffer instanceof Buffer ? fileBuffer.byteLength : (fileBuffer as Blob).size;
  console.log(`[BunnyStream] uploadToBunny 调用: guid="${guid}", bufferSize=${bufferSize} bytes (${(bufferSize / 1024 / 1024).toFixed(2)} MB), Content-Type="application/octet-stream", url="${url}"`);

  try {
    const apiKey = getEnv('BUNNY_API_KEY');
    console.log(`[BunnyStream] uploadToBunny: key prefix=${apiKey.slice(0, 6)}… length=${apiKey.length}`);
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer as BodyInit,
      signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    console.log(`[BunnyStream] 视频二进制流上传成功，guid=${guid}`);
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      console.error(`[BunnyStream] uploadToBunny 超时中止（guid=${guid}）`);
      throw new Error(`Bunny Stream 上传超时（uploadVideo），文件较大请耐心等待或检查网络后重试`);
    }
    console.error(`[BunnyStream] uploadToBunny 失败（guid=${guid}）：`, err);
    throw err;
  }
}

/**
 * 让 Bunny 服务器主动拉取指定 URL 的视频并自动转码。
 * 【高优先级迁移工具】用于将旧 OSS 视频链接一键迁移至 Bunny Stream，
 * 无需经过本地服务器中转，极大节省带宽与时间。
 *
 * @param videoUrl  旧视频的完整可访问 URL（如阿里云 OSS 地址）
 * @param title     视频标题，将在 Bunny 媒体库中显示
 * @returns         新视频的 Bunny guid
 *
 * @example
 *   const guid = await fetchFromUrlToBunny(
 *     'https://pub-xxxx.r2.dev/uploads/1749001234567-abc.mp4',
 *     '影片迁移'
 *   );
 */
export async function fetchFromUrlToBunny(
  videoUrl: string,
  title: string,
): Promise<string> {
  const libraryId = getEnv('BUNNY_LIBRARY_ID');

  // Step 1: 先创建空占位符，获取 guid
  const guid = await createBunnyVideo(title);

  // Step 2: 触发 Bunny Fetch API，让 Bunny 主动拉取源 URL
  const fetchUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}/fetch`;

  try {
    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ url: videoUrl }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    console.log(
      `[BunnyStream] Fetch 迁移任务已提交，guid=${guid}，源地址="${videoUrl}"`,
    );

    return guid;
  } catch (err) {
    console.error(
      `[BunnyStream] fetchFromUrlToBunny 失败（guid=${guid}，url="${videoUrl}"）：`,
      err,
    );
    throw err;
  }
}

// ─── 前端播放 URL 组装助手（客户端安全，不含密钥） ────────────────────────────

/**
 * 根据 Bunny 视频 guid 组装 HLS 播放地址（m3u8）。
 * 可在前端直接调用，无需服务端中转。
 *
 * @param guid  Bunny 视频 guid
 * @returns     HLS playlist URL，格式：https://<CDN_HOSTNAME>/<guid>/playlist.m3u8
 *
 * @example
 *   const hlsUrl = getBunnyHlsUrl('abc-123-def');
 *   // → "https://vz-eb1ce7ba-274.b-cdn.net/abc-123-def/playlist.m3u8"
 */
export function getBunnyHlsUrl(guid: string): string {
  const cdnHostname =
    process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ??
    process.env.BUNNY_CDN_HOSTNAME;

  if (!cdnHostname) {
    console.error(
      '[BunnyStream] getBunnyHlsUrl: 缺少 CDN Hostname 环境变量，' +
        '请配置 NEXT_PUBLIC_BUNNY_CDN_HOSTNAME（前端）或 BUNNY_CDN_HOSTNAME（服务端）',
    );
    return '';
  }

  return `https://${cdnHostname}/${guid}/playlist.m3u8`;
}

/**
 * 根据 Bunny 视频 guid 组装缩略图地址。
 * Bunny 会在转码完成后自动生成 thumbnail.jpg。
 * 可在前端直接调用，无需服务端中转。
 *
 * @param guid  Bunny 视频 guid
 * @returns     缩略图 URL，格式：https://<CDN_HOSTNAME>/<guid>/thumbnail.jpg
 *
 * @example
 *   const thumbUrl = getBunnyThumbnailUrl('abc-123-def');
 *   // → "https://vz-eb1ce7ba-274.b-cdn.net/abc-123-def/thumbnail.jpg"
 */
export function getBunnyThumbnailUrl(guid: string): string {
  const cdnHostname =
    process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ??
    process.env.BUNNY_CDN_HOSTNAME;

  if (!cdnHostname) {
    console.error(
      '[BunnyStream] getBunnyThumbnailUrl: 缺少 CDN Hostname 环境变量，' +
        '请配置 NEXT_PUBLIC_BUNNY_CDN_HOSTNAME（前端）或 BUNNY_CDN_HOSTNAME（服务端）',
    );
    return '';
  }

  return `https://${cdnHostname}/${guid}/thumbnail.jpg`;
}
```

### lib/cloudflareR2.ts
```typescript
/**
 * lib/cloudflareR2.ts
 *
 * Cloudflare R2 静态文件上传工具（仅服务端调用，含密钥）
 *
 * 完全兼容 AWS S3 协议，负责将图片、PDF 等静态资源上传至 R2，
 * 并返回通过公共 CDN 域名直接访问的免流 URL。
 *
 * 环境变量（.env.local）：
 *  R2_ACCOUNT_ID            — Cloudflare Account ID
 *  R2_BUCKET_NAME           — R2 Bucket 名称
 *  R2_ACCESS_KEY_ID         — R2 API Token Access Key
 *  R2_SECRET_ACCESS_KEY     — R2 API Token Secret Key
 *  NEXT_PUBLIC_R2_PUBLIC_DOMAIN — 公共访问域名（不含尾部斜杠）
 *                               例：https://pub-xxxx.r2.dev
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ─── S3 兼容客户端初始化 ──────────────────────────────────────────────────────

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('[R2] 缺少必要环境变量：R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// ─── 核心上传函数 ──────────────────────────────────────────────────────────────

/**
 * 将文件 Buffer 上传至 Cloudflare R2，返回公共可访问 URL。
 *
 * @param fileBuffer      文件二进制内容
 * @param originalFileName 原始文件名（用于提取扩展名）
 * @param contentType     MIME 类型（如 "image/jpeg", "application/pdf"）
 * @returns               R2 公共域名拼接的完整 URL
 *
 * @example
 *   const url = await uploadFileToR2(buffer, 'poster.jpg', 'image/jpeg');
 *   // → "https://pub-xxxx.r2.dev/uploads/1749001234567-k9m2p.jpg"
 */
export async function uploadFileToR2(
  fileBuffer: Buffer,
  originalFileName: string,
  contentType: string,
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;

  if (!bucketName || !publicDomain) {
    throw new Error('[R2] 缺少必要环境变量：R2_BUCKET_NAME / NEXT_PUBLIC_R2_PUBLIC_DOMAIN');
  }

  // 生成唯一文件名，防止重名覆盖
  const ext = originalFileName.includes('.')
    ? originalFileName.split('.').pop()!.toLowerCase()
    : '';
  const uniqueKey = ext
    ? `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    : `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: contentType,
      // R2 public bucket：不需要 ACL，可见性由 Bucket 级别设置控制
    }),
  );

  const publicUrl = `${publicDomain.replace(/\/$/, '')}/${uniqueKey}`;
  console.log(`[R2] 文件上传成功：${publicUrl}`);
  return publicUrl;
}
```

### lib/solana/hdWallet.ts
```typescript
/**
 * HD Wallet 工具 — 服務端專用，物理隔離，前端絕對無法 import 此文件
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  安全架構摘要                                                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  [物理隔離]  import 'server-only' 強制 Next.js 在 Bundle      ║
 * ║             時拒絕任何前端代碼 import 此模塊，洩漏即構建報錯    ║
 * ║  [零前綴]   MASTER_SEED_PHRASE 永不使用 NEXT_PUBLIC_ 前綴，   ║
 * ║             不會進入客戶端 env bundle，物理無法被讀取           ║
 * ║  [路徑碰撞] index 0 永久保留給墊付錢包 (m/44'/501'/0'/0')，   ║
 * ║             generateUserWallet 有鈦合金 guard 攔截             ║
 * ║  [純 ATA]  initUserDepositATA 絕對只創建 ATA，嚴禁轉 SOL      ║
 * ║             payer=墊付錢包，owner=用戶充值地址，冪等安全       ║
 * ║  [枯竭告警] 墊付錢包低於 0.05 SOL 觸發 CRITICAL ALARM         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'server-only';

import { derivePath } from 'ed25519-hd-key';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from '@solana/spl-token';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import { createClient } from '@supabase/supabase-js';

// ── 系統常量 ───────────────────────────────────────────────────────────────────

/** 墊付錢包固定路徑（HD 根帳號，index 0 永久保留給系統，絕不分配給用戶） */
const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";

/** 墊付錢包餘額低於此值時觸發 CRITICAL ALARM */
const FUNDING_ALARM_LAMPORTS = Math.floor(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL

/** 墊付錢包餘額低於此值時拒絕執行，防止構建無效交易 */
const FUNDING_MIN_LAMPORTS = Math.floor(0.005 * LAMPORTS_PER_SOL); // 0.005 SOL

// ── 公開類型 ───────────────────────────────────────────────────────────────────

export interface InitAtaResult {
  /** activated: ATA 本次新建 | already_complete: ATA 已存在，零消耗 */
  status: 'activated' | 'already_complete';
  ataCreated: boolean;
  txSignature: string | null;
}

export interface SweepResult {
  /** true = 本次有代幣被歸集；false = 鏈上餘額為 0，無需操作 */
  swept: boolean;
  /** 歸集的 AIF 數量（整數單位，已除以 10^decimals） */
  aifAmount: number;
  /** 鏈上原始 bigint 數量 */
  rawAmount: bigint;
  /** Token 精度 */
  decimals: number;
  /** 歸集交易簽名 (swept=true 時有值) */
  txSignature: string | null;
  /** 用戶充值地址 */
  depositAddress: string;
}

// ── 私有工具 ───────────────────────────────────────────────────────────────────

/**
 * 根據 walletIndex 派生用戶充值地址的完整 Keypair（含私鑰）。
 * 僅供服務端內部使用，用於歸集交易的授權簽名。
 * 鈦合金防護：index 0 或 null 立即拋出 CRITICAL SECURITY FATAL。
 */
function deriveDepositKeypair(walletIndex: number): Keypair {
  if (walletIndex === 0 || walletIndex == null) {
    throw new Error(
      'CRITICAL SECURITY FATAL: wallet_index cannot be 0 or null. ' +
      'Path collision with Funding Wallet. (m/44\'/501\'/0\'/0\')'
    );
  }
  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) throw new Error('[deriveDepositKeypair] MASTER_SEED_PHRASE 未配置');
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('[deriveDepositKeypair] MASTER_SEED_PHRASE 不是合法的 BIP39 助記詞');
  }
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(`m/44'/501'/${walletIndex}'/0'`, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveFundingWalletFromSeed(seedPhrase: string): Keypair {
  if (!seedPhrase) {
    throw new Error('[HD Wallet] 助記詞為空，無法派生墊付錢包');
  }
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveFundingWallet(): Keypair {
  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 未配置，無法派生墊付錢包');
  }
  return deriveFundingWalletFromSeed(seedPhrase);
}

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── 公開工具 ───────────────────────────────────────────────────────────────────

/**
 * 從任意 BIP39 助記詞派生墊付錢包公鑰地址。
 */
export function getFundingWalletAddressFromSeed(seedPhrase: string): string {
  const keypair = deriveFundingWalletFromSeed(seedPhrase);
  return keypair.publicKey.toBase58();
}

/**
 * 根據 walletIndex 派生用戶的 Solana 充值公鑰地址。
 *
 * 【鈦合金防護罩】：index 0 或 null 立即拋出 CRITICAL SECURITY FATAL。
 */
export function generateUserWallet(walletIndex: number): string {
  if (walletIndex === 0 || walletIndex == null) {
    throw new Error(
      "CRITICAL SECURITY FATAL: Wallet Index cannot be 0 or null. " +
      "Path collision with Funding Wallet detected. (m/44'/501'/0'/0')"
    );
  }

  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 環境變數未配置');
  }
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 不是合法的 BIP39 助記詞');
  }

  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const derivationPath = `m/44'/501'/${walletIndex}'/0'`;
  const { key } = derivePath(derivationPath, seed.toString('hex'));
  const keypair = Keypair.fromSeed(key);
  return keypair.publicKey.toBase58();
}

/**
 * 為用戶充值地址創建 AIF Associated Token Account (ATA)。
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  絕對禁止：此函數嚴禁包含任何 SystemProgram.transfer 指令  ║
 * ║  只允許：createAssociatedTokenAccountIdempotentInstruction ║
 * ║  payer = 墊付錢包（支付 ATA rent）                         ║
 * ║  owner = 用戶充值地址                                      ║
 * ║  冪等：ATA 已存在時零消耗直接返回 already_complete          ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * @param depositAddress - 用戶充值地址（Base58 字串）
 * @returns InitAtaResult
 * @throws 墊付錢包餘額不足、RPC 異常時拋出
 */
export async function initUserDepositATA(depositAddress: string): Promise<InitAtaResult> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const mintAddress = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
  const feePayerKey = process.env.FEE_PAYER_PRIVATE_KEY;

  if (!mintAddress) {
    throw new Error('[initUserDepositATA] NEXT_PUBLIC_AIF_MINT_ADDRESS 未配置');
  }
  if (!feePayerKey) {
    throw new Error('[initUserDepositATA] FEE_PAYER_PRIVATE_KEY 未配置');
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const fundingWallet = Keypair.fromSecretKey(bs58.decode(feePayerKey));
  const userPublicKey = new PublicKey(depositAddress);
  const mintPublicKey = new PublicKey(mintAddress);

  // ── 墊付錢包枯竭預警 ──────────────────────────────────────────────────────
  const fundingBalance = await connection.getBalance(fundingWallet.publicKey);

  if (fundingBalance < FUNDING_ALARM_LAMPORTS) {
    console.error(
      `CRITICAL ALARM: Funding wallet [${fundingWallet.publicKey.toBase58()}] ` +
      `is critically low on SOL! Current: ${(fundingBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL. ` +
      `Alarm threshold: ${FUNDING_ALARM_LAMPORTS / LAMPORTS_PER_SOL} SOL. Please top up immediately!`
    );
    try {
      const adminSupabase = createAdminSupabase();
      await adminSupabase.from('messages').insert({
        user_id: null,
        type: 'system',
        title: '⚠️ 墊付錢包 SOL 餘額緊急告警',
        body:
          `墊付錢包 ${fundingWallet.publicKey.toBase58()} 餘額僅剩 ` +
          `${(fundingBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL，` +
          `已低於安全閾值 ${FUNDING_ALARM_LAMPORTS / LAMPORTS_PER_SOL} SOL，` +
          `請立即充值，否則新用戶 ATA 初始化將失敗！`,
        is_read: false,
      });
    } catch (dbErr: unknown) {
      console.error('[initUserDepositATA] 系統告警寫入失敗:', dbErr);
    }
  }

  if (fundingBalance < FUNDING_MIN_LAMPORTS) {
    throw new Error(
      `[initUserDepositATA] ABORT: Funding wallet balance critically insufficient. ` +
      `Current: ${fundingBalance} lamports, minimum: ${FUNDING_MIN_LAMPORTS} lamports.`
    );
  }

  // ── 計算 ATA 地址 ──────────────────────────────────────────────────────────
  const ata = await getAssociatedTokenAddress(mintPublicKey, userPublicKey);

  // ── 冪等校驗：ATA 已存在則直接返回，零消耗 ───────────────────────────────
  const ataAccountInfo = await connection.getAccountInfo(ata);
  if (ataAccountInfo !== null) {
    return { status: 'already_complete', ataCreated: false, txSignature: null };
  }

  // ── 構建純 ATA 創建交易（嚴禁 SystemProgram.transfer）────────────────────
  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      fundingWallet.publicKey, // payer：墊付錢包支付 rent
      ata,                     // associatedToken
      userPublicKey,           // owner：用戶充值地址
      mintPublicKey            // mint：AIF Token Mint
    )
  );

  // 必須顯式設置 recentBlockhash 和 feePayer，否則 serialize() 時拋出 "Transaction recentBlockhash required"
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = fundingWallet.publicKey;

  let signature: string;
  try {
    signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [fundingWallet],
      { commitment: 'confirmed' }
    );
  } catch (txErr: unknown) {
    const detail = txErr instanceof Error ? txErr.message : String(txErr);
    throw new Error(`ATA 交易上鏈失敗: ${detail}`);
  }

  console.log(
    `[initUserDepositATA] ATA 創建成功 → 用戶: ${depositAddress} | ` +
    `ATA: ${ata.toBase58()} | tx: ${signature}`
  );

  return { status: 'activated', ataCreated: true, txSignature: signature };
}

/**
 * 歸集用戶充值地址上的全部 AIF 代幣到平台金庫（Treasury）。
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  雙簽授權架構                                                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Fee Payer   → FEE_PAYER_PRIVATE_KEY (Base58) 墊付 Gas       ║
 * ║  Transfer    → MASTER_SEED_PHRASE + wallet_index 實時派生     ║
 * ║              的用戶 Deposit Keypair（才是 ATA owner/authority）║
 * ║  signers     → [feePayerKeypair, depositKeypair]              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 冪等保障：
 *  - 鏈上 AIF 餘額為 0 時直接返回 swept=false，不構建任何交易
 *  - 多次調用安全，不會重複歸集
 *
 * 安全驗證：
 *  - 派生地址與傳入 depositAddress 強制校驗，不匹配立即中止
 *
 * @param walletIndex      用戶的 HD Wallet index（必須 > 0）
 * @param depositAddress   用戶的充值地址（Base58），用於安全校驗
 * @returns SweepResult
 */
export async function sweepUserDeposit(
  walletIndex: number,
  depositAddress: string,
): Promise<SweepResult> {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const mintAddress = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
  const feePayerKey = process.env.FEE_PAYER_PRIVATE_KEY;
  const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_WALLET;

  if (!mintAddress)     throw new Error('[sweepUserDeposit] NEXT_PUBLIC_AIF_MINT_ADDRESS 未配置');
  if (!feePayerKey)     throw new Error('[sweepUserDeposit] FEE_PAYER_PRIVATE_KEY 未配置');
  if (!treasuryAddress) throw new Error('[sweepUserDeposit] NEXT_PUBLIC_TREASURY_WALLET 未配置');

  const connection = new Connection(rpcUrl, 'confirmed');
  const feePayerKeypair = Keypair.fromSecretKey(bs58.decode(feePayerKey));
  const depositKeypair  = deriveDepositKeypair(walletIndex);

  // 安全校驗：派生地址必須與資料庫存儲地址完全一致
  const derivedAddress = depositKeypair.publicKey.toBase58();
  if (derivedAddress !== depositAddress) {
    throw new Error(
      `[sweepUserDeposit] SECURITY VIOLATION: Derived address (${derivedAddress}) ` +
      `does not match stored depositAddress (${depositAddress}). Aborting.`
    );
  }

  const mintPublicKey     = new PublicKey(mintAddress);
  const treasuryPublicKey = new PublicKey(treasuryAddress);
  const sourceAta = await getAssociatedTokenAddress(mintPublicKey, depositKeypair.publicKey);
  const destAta   = await getAssociatedTokenAddress(mintPublicKey, treasuryPublicKey);

  // ── 查詢充值地址的鏈上 AIF 餘額 ──────────────────────────────────────────
  let rawBalance: bigint;
  let decimals: number;
  try {
    const [sourceAccount, mintInfo] = await Promise.all([
      getAccount(connection, sourceAta),
      getMint(connection, mintPublicKey),
    ]);
    rawBalance = sourceAccount.amount;
    decimals   = mintInfo.decimals;
  } catch {
    // ATA 不存在或查詢失敗 → 餘額視為 0
    return {
      swept: false, aifAmount: 0, rawAmount: BigInt(0),
      decimals: 6, txSignature: null, depositAddress,
    };
  }

  if (rawBalance === BigInt(0)) {
    return {
      swept: false, aifAmount: 0, rawAmount: BigInt(0),
      decimals, txSignature: null, depositAddress,
    };
  }

  const aifAmount = Number(rawBalance) / Math.pow(10, decimals);

  // ── 墊付錢包枯竭預警 ──────────────────────────────────────────────────────
  const feeBalance = await connection.getBalance(feePayerKeypair.publicKey);
  if (feeBalance < FUNDING_MIN_LAMPORTS) {
    throw new Error(
      `[sweepUserDeposit] ABORT: Fee payer balance critically insufficient. ` +
      `Current: ${feeBalance} lamports, minimum: ${FUNDING_MIN_LAMPORTS} lamports.`
    );
  }

  // ── 構建雙簽歸集交易 ──────────────────────────────────────────────────────
  const tx = new Transaction();

  // 確保金庫 ATA 存在（冪等，已有時零消耗）
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      feePayerKeypair.publicKey, // payer: 墊付錢包
      destAta,
      treasuryPublicKey,         // owner: 金庫地址
      mintPublicKey,
    )
  );

  // 將全部 AIF 從充值地址 ATA 轉移至金庫 ATA
  tx.add(
    createTransferCheckedInstruction(
      sourceAta,                   // source token account
      mintPublicKey,               // mint
      destAta,                     // destination token account
      depositKeypair.publicKey,    // authority (owner of source ATA)
      rawBalance,                  // amount (raw bigint)
      decimals,                    // decimals
    )
  );

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer        = feePayerKeypair.publicKey;

  let signature: string;
  try {
    signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [feePayerKeypair, depositKeypair], // Fee Payer + Transfer Authority
      { commitment: 'confirmed' }
    );
  } catch (txErr: unknown) {
    const detail = txErr instanceof Error ? txErr.message : String(txErr);
    throw new Error(`[sweepUserDeposit] 歸集交易失敗: ${detail}`);
  }

  console.log(
    `[sweepUserDeposit] ✅ 歸集成功 | 用戶充值地址: ${depositAddress} → ` +
    `金庫: ${treasuryAddress} | 金額: ${aifAmount} AIF | tx: ${signature}`
  );

  return { swept: true, aifAmount, rawAmount: rawBalance, decimals, txSignature: signature, depositAddress };
}

// ── 向後兼容別名（供舊代碼過渡期使用，最終應替換為 initUserDepositATA）────────
/** @deprecated 使用 initUserDepositATA 取代，此別名將在下一版本移除 */
export const preActivateUserATA = initUserDepositATA;
export type PreActivateResult = InitAtaResult & { solTransferred: false };
```

### lib/solana/initUserAifAta.ts
```typescript
/**
 * initUserAifAta — 為用戶充值地址初始化 AIF Associated Token Account (ATA)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  絕對禁止：此模塊嚴禁任何 SystemProgram.transfer（SOL 轉帳）  ║
 * ║  只允許：createAssociatedTokenAccountIdempotentInstruction    ║
 * ║  payer = 系統墊付錢包，owner = 用戶充值地址                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 作用：
 *   確保用戶的 deposit_address 具備接收 AIF SPL Token 的能力。
 *   未初始化的地址在用戶使用 Phantom 掃碼充值時會報 Error 256 (InvalidAccountData)。
 *
 * 安全設計：
 *   - 服務端專用（import 'server-only'），前端無法 import
 *   - 使用系統墊付錢包 (Gas Funder) 支付 ATA 建立的 SOL 租金
 *   - 採用 createAssociatedTokenAccountIdempotentInstruction（冪等），
 *     ATA 已存在時不報錯，多次調用安全
 *
 * 調用時機：
 *   - 用戶打開充值頁面（Top Up Modal）時，useRef 鎖保護，一次性觸發
 */

import 'server-only';

import { initUserDepositATA, type InitAtaResult } from './hdWallet';

export interface InitAifAtaResult {
  success: boolean;
  status: InitAtaResult['status'] | 'error';
  ataCreated: boolean;
  txSignature: string | null;
  error?: string;
}

/**
 * 為指定的用戶充值地址初始化 AIF ATA。
 *
 * 冪等：ATA 已存在時零消耗直接返回 already_complete。
 *
 * @param depositAddress - 用戶的 Solana 充值地址 (Base58)
 * @param timeoutMs - RPC 超時上限（毫秒），默認 20000ms
 */
export async function initUserAifAta(
  depositAddress: string,
  timeoutMs = 20_000
): Promise<InitAifAtaResult> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`ATA 初始化超時（${timeoutMs / 1000}s），RPC 節點響應過慢`)),
      timeoutMs
    )
  );

  try {
    const result = await Promise.race([
      initUserDepositATA(depositAddress),
      timeoutPromise,
    ]);

    return {
      success: true,
      status: result.status,
      ataCreated: result.ataCreated,
      txSignature: result.txSignature,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[initUserAifAta] 初始化失敗 (${depositAddress}):`, message);
    return {
      success: false,
      status: 'error',
      ataCreated: false,
      txSignature: null,
      error: message,
    };
  }
}
```

### lib/utils/encryption.ts
```typescript
/**
 * 數據庫層高級加密工具 — 服務端專用
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  安全規格                                                      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  算法：AES-256-CBC                                             ║
 * ║  密鑰：32 字節（256 位），來自 DB_ENCRYPTION_KEY 環境變量      ║
 * ║  IV：每次加密隨機生成 16 字節，與密文一同存儲                   ║
 * ║  格式：iv_hex:ciphertext_hex（冒號分隔）                        ║
 * ║  物理隔離：import 'server-only' 阻止前端 bundle 引入            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * 從環境變量獲取並標準化加密密鑰（強制 32 字節）。
 * 使用 SHA-256 對原始值做哈希，無論輸入長度如何均輸出固定 32 字節。
 */
function getDerivedKey(): Buffer {
  const raw = process.env.DB_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[Encryption] DB_ENCRYPTION_KEY 環境變量未配置。' +
      '請在 .env.local 中添加一個至少 32 字符的隨機字符串。'
    );
  }
  // SHA-256 派生，確保精確 32 字節，與原始密鑰長度無關
  return createHash('sha256').update(raw).digest();
}

/**
 * 使用 AES-256-CBC 加密敏感文本（如助記詞）。
 *
 * @param plaintext - 要加密的明文字符串
 * @returns 格式為 `iv_hex:ciphertext_hex` 的加密字符串，可安全存入數據庫
 * @throws DB_ENCRYPTION_KEY 未配置時拋出
 */
export function encryptSeed(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 解密由 encryptSeed 生成的加密字符串，還原原始明文。
 *
 * @param encryptedText - 格式為 `iv_hex:ciphertext_hex` 的加密字符串
 * @returns 解密後的明文字符串
 * @throws 格式錯誤、密鑰不匹配或 DB_ENCRYPTION_KEY 未配置時拋出
 */
export function decryptSeed(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error(
      '[Encryption] 密文格式不合法。期望格式：iv_hex:ciphertext_hex'
    );
  }
  const [ivHex, ciphertextHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error('[Encryption] IV 長度不合法，數據可能已損壞');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
}
```

### lib/utils/oss.ts
```typescript
/**
 * lib/utils/oss.ts
 *
 * 媒体 URL 工具函数（客户端安全，不含密钥）
 *
 * 历史背景：
 *  系统已全面迁移至 Cloudflare R2（图片）和 Bunny Stream（视频）。
 *  本文件保留向后兼容支持 —— 数据库中部分历史记录仍存有旧版 OSS Object Key 格式，
 *  需要通过 buildOssUrl() 还原为可访问的完整 URL。
 *
 * 新上传的所有媒体文件均已存储为完整 https:// URL，buildOssUrl() 会直接透传。
 *
 * 设计原则：
 *  - 若字段值已是完整 URL（https://）→ 原样返回（适用于 R2 / Bunny / 旧 OSS CDN URL）
 *  - 若字段值为旧 OSS Object Key → 拼接旧 OSS 基础 URL（向后兼容历史数据，只读）
 *  - 若为空 → 返回空字符串
 */

// 旧版 OSS 基础 URL（仅用于向后兼容历史数据，新数据不再写入 OSS）
const LEGACY_OSS_BASE_URL = 'https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com';

/** @deprecated 仅供历史数据 URL 拼接，新代码请直接存储完整 URL */
export const OSS_BASE_URL = LEGACY_OSS_BASE_URL;

/**
 * 将媒体字段值（完整 URL 或旧版 OSS Object Key）转换为可访问的完整 URL。
 *
 * - 已是完整 URL（http/https 开头）→ 原样返回（R2 / Bunny / 旧 OSS CDN URL）
 * - 旧 OSS Object Key → 拼接旧 OSS 基础 URL（向后兼容）
 * - 空值 → 返回空字符串
 */
export function buildOssUrl(keyOrUrl: string | null | undefined): string {
  if (!keyOrUrl) return '';

  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return keyOrUrl;
  }

  // 旧 OSS Object Key — 向后兼容历史数据
  const key = keyOrUrl.startsWith('/') ? keyOrUrl.slice(1) : keyOrUrl;
  return `${LEGACY_OSS_BASE_URL}/${key}`;
}

/**
 * 从完整 URL 中提取路径部分（去除域名和前导斜杠）。
 * 主要用于向 /api/media/get-play-url 传递资源标识符。
 *
 * 例：
 *   "https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com/films/abc/video.mp4"
 *   → "films/abc/video.mp4"
 *
 *   "https://vz-eb1ce7ba-274.b-cdn.net/abc-guid/playlist.m3u8"
 *   → "abc-guid/playlist.m3u8"
 */
export function extractOssKey(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, '');
  } catch {
    return url.startsWith('/') ? url.slice(1) : url;
  }
}

/**
 * 向 /api/media/get-play-url 请求受保护资源的可播放 URL。
 * 接口在返回 URL 前会验证 Privy Token 及业务权限（付款状态 / LBS 地理围栏）。
 *
 * @param objectKey  资源路径或完整 URL
 * @param filmId     影片 ID（film 类型必传）
 * @param accessToken Privy Access Token
 * @param opts       可选参数（lbsNodeId, userLat, userLng, expiresSeconds）
 */
export async function fetchSignedPlayUrl(
  objectKey: string,
  filmId: string,
  accessToken: string,
  opts?: {
    resourceType?: 'film' | 'lbs';
    lbsNodeId?: string;
    userLat?: number;
    userLng?: number;
    expiresSeconds?: number;
  }
): Promise<string> {
  const res = await fetch('/api/media/get-play-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      objectKey,
      resourceType: opts?.resourceType ?? 'film',
      filmId,
      lbsNodeId: opts?.lbsNodeId,
      userLat: opts?.userLat,
      userLng: opts?.userLng,
      expiresSeconds: opts?.expiresSeconds ?? 1800,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to get play URL (${res.status})`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('No URL returned from media API');
  return data.url as string;
}
```

### lib/utils/parse-csv.ts
```typescript
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function parseCSV<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as T[]),
      error: (error) => reject(error),
    });
  });
}

export function parseXLSX<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<T>(sheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function parseSpreadsheet<T>(file: File): Promise<T[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXLSX<T>(file);
  }
  return parseCSV<T>(file);
}
```

### lib/actions/message.ts
```typescript
/**
 * lib/actions/message.ts
 *
 * 全局消息处理工具 — 服务端专用（使用 Service Role Key 绕过 RLS）
 * 只能在 Server Components、API Routes、Server Actions 中调用。
 */

import { createClient } from '@supabase/supabase-js';

// ── 类型定义 ───────────────────────────────────────────────────────────────────

export type MsgType = 'system' | 'renders' | 'on-chain' | 'lbs';

export interface DbMessage {
  id: string;
  msg_id: string | null;
  user_id: string | null;
  msg_type: MsgType;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  status: 'sent' | 'delivered' | 'failed';
  sender_id: string | null;
  action_link: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SendMessageParams {
  /** 目标用户 ID；传 null 表示全站广播 */
  userId: string | null;
  type: MsgType;
  title: string;
  content: string;
  /** 可选跳转链接 */
  actionLink?: string | null;
  /** 发送者 ID（可选；NULL = 系统自动发送） */
  senderId?: string | null;
}

// ── 内部：创建 Admin Supabase 客户端 ──────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[message] Missing SUPABASE env variables');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── 发送单条消息（个人通知 或 广播 userId=null） ──────────────────────────────

export async function sendMessage({
  userId,
  type,
  title,
  content,
  actionLink,
  senderId,
}: SendMessageParams): Promise<void> {
  const db = getAdminClient();
  const { error } = await db.from('messages').insert({
    user_id: userId,
    type,
    msg_type: type,
    title,
    content,
    body: content,               // 向后兼容旧 body 列
    status: 'sent',
    ...(actionLink != null ? { action_link: actionLink } : {}),
    ...(senderId != null ? { sender_id: senderId } : {}),
  });
  if (error) {
    console.error('[sendMessage] insert failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 获取用户消息（个人 + 广播，排除软删除）────────────────────────────────────

export async function getUserMessages(userId: string): Promise<DbMessage[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from('messages')
    .select('id, msg_id, user_id, type, msg_type, title, content, body, is_read, status, sender_id, action_link, created_at, deleted_at')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getUserMessages] query failed:', error.message);
    throw new Error(error.message);
  }

  // 兼容旧 body 字段
  return ((data ?? []) as DbMessage[]).map((m) => ({
    ...m,
    content: m.content ?? (m as unknown as Record<string, string>)['body'] ?? '',
  }));
}

// ── 标记单条已读 ───────────────────────────────────────────────────────────────

export async function markAsRead(messageId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId)
    .is('deleted_at', null);
  if (error) {
    console.error('[markAsRead] failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 标记用户全部已读 ──────────────────────────────────────────────────────────

export async function markAllAsRead(userId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .is('deleted_at', null);
  if (error) {
    console.error('[markAllAsRead] failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 软删除消息 ────────────────────────────────────────────────────────────────

export async function softDeleteMessage(messageId: string, userId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) {
    console.error('[softDeleteMessage] failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 查询历史发送记录（Admin 用）────────────────────────────────────────────────

export interface MessageHistoryRow {
  id: string;
  msg_id: string | null;
  msg_type: string;
  type: string;
  title: string;
  user_id: string | null;
  sender_id: string | null;
  status: string;
  created_at: string;
  deleted_at: string | null;
}

export async function getMessageHistory(
  limit = 100,
  fromDate?: string,
  toDate?: string
): Promise<MessageHistoryRow[]> {
  const db = getAdminClient();
  let query = db
    .from('messages')
    .select('id, msg_id, msg_type, type, title, user_id, sender_id, status, created_at, deleted_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fromDate) query = query.gte('created_at', fromDate);
  if (toDate) query = query.lte('created_at', toDate);

  const { data, error } = await query;
  if (error) {
    console.error('[getMessageHistory] query failed:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as MessageHistoryRow[];
}
```

### lib/hooks/useProduct.ts
```typescript
'use client';

/**
 * useProduct / useProducts
 *
 * 萬能產品 Hook — 從 /api/products 拉取 platform_products 清單，
 * 帶輕量級內存緩存（模塊級單例），避免組件重複請求。
 *
 * 用法：
 *   const { product, loading, error } = useProduct('vip_ticket');
 *   const { products, loading } = useProducts();
 */

import { useEffect, useState } from 'react';

// ─── 類型定義（與 platform_products 表結構對齊）──────────────────────────────
export interface PlatformProduct {
  id: string;
  product_code: string;
  name_zh: string;
  name_en: string;
  price_usd: number;
  price_aif: number;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

// ─── 模塊級緩存（跨組件共享，頁面刷新前有效）───────────────────────────────────
const productByCode = new Map<string, PlatformProduct>();
let cachedAll: PlatformProduct[] | null = null;
let inflight: Promise<PlatformProduct[]> | null = null;

async function fetchProducts(): Promise<PlatformProduct[]> {
  if (cachedAll !== null) return cachedAll;
  if (inflight) return inflight;

  inflight = fetch('/api/products')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ products: PlatformProduct[] }>;
    })
    .then(({ products }) => {
      cachedAll = products;
      products.forEach((p) => productByCode.set(p.product_code, p));
      return products;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

// ─── useProduct：按 productCode 查單個產品 ─────────────────────────────────────
export function useProduct(productCode: string) {
  const cached = productByCode.get(productCode);
  const [product, setProduct] = useState<PlatformProduct | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productByCode.has(productCode)) {
      setProduct(productByCode.get(productCode)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProducts()
      .then((products) => {
        if (cancelled) return;
        const found = products.find((p) => p.product_code === productCode) ?? null;
        setProduct(found);
        if (!found) setError(`Product "${productCode}" not found`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [productCode]);

  return { product, loading, error };
}

// ─── useProducts：取完整產品清單 ───────────────────────────────────────────────
export function useProducts() {
  const [products, setProducts] = useState<PlatformProduct[]>(cachedAll ?? []);
  const [loading, setLoading] = useState(!cachedAll);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedAll !== null) {
      setProducts(cachedAll);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProducts()
      .then((p) => { if (!cancelled) setProducts(p); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load products');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}

// ─── 工具函數：強制清除緩存（例如後台更新產品後刷新） ────────────────────────────
export function invalidateProductCache() {
  cachedAll = null;
  productByCode.clear();
}
```

## 核心前端页面
### app/layout.tsx
```typescript
import type { Metadata } from "next";
import ClientProviders from "./components/ClientProviders";
import ConditionalNav from "./components/ConditionalNav";
import Providers from "@/components/Providers";
import "./globals.css";

import PwaInstallPrompt from "@/components/PwaInstallPrompt";

export const metadata: Metadata = {
  metadataBase: new URL('https://hkaiiff.com'),
  title: 'HKAIIFF | 香港AI國際電影節',
  description: 'Something has to change. 香港政府批復註冊的全球首個AI原生國際電影節',
  manifest: '/manifest.json',
  openGraph: {
    title: 'HKAIIFF | 香港AI國際電影節',
    description: 'Something has to change. 香港政府批復註冊的全球首個AI原生國際電影節',
    url: '/',
    siteName: 'HKAIIFF',
    images: [
      {
        url: '/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'HKAIIFF Official Logo',
      },
    ],
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HKAIIFF | 香港AI國際電影節',
    description: 'Something has to change. 香港政府批復註冊的全球首個AI原生國際電影節',
    images: ['/icon-512x512.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;700;900&family=Space+Mono:wght@400;700&family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#CCFF00" />
        <meta name="application-name" content="HKAIIFF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HKAIIFF" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512x512.png" />
      </head>
      {/* bg/text 由 ConditionalNav 按路由分流處理：前台=bg-void/text-white，/admin=白底畫布 */}
      <body className="font-zh antialiased">
        <Providers>
        <ClientProviders>
          <ConditionalNav>
            {children}
          </ConditionalNav>
          <PwaInstallPrompt />
        </ClientProviders>
        </Providers>
      </body>
    </html>
  );
}
```

### app/page.tsx
```typescript
"use client";

import { useRef, useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useModal } from "@/app/context/ModalContext";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { usePrivy } from "@privy-io/react-auth";
import type { Film } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { buildOssUrl } from "@/lib/utils/oss";
import Link from "next/link";
import IdentityBadges from "@/app/components/IdentityBadges";
import FeedVideo from "@/components/FeedVideo";
import PrivyLoginWithConsent from "@/components/PrivyLoginWithConsent";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupabaseFilm {
  id: string;
  title: string;
  studio: string | null;
  tech_stack: string | null;
  ai_ratio: number | null;
  poster_url: string | null;
  trailer_url: string | null;
  feature_url: string | null;
  video_url?: string | null;
  user_id?: string | null;
  created_at: string;
  is_parallel_universe?: boolean | null;
  parallel_start_time?: string | null;
  user_avatar_seed?: string | null;
  user_display_name?: string | null;
  user_verified_identities?: string[] | null;
}

// ─── Parallel Universe State Helpers ──────────────────────────────────────────

type ParallelState = "NONE" | "PENDING" | "LIVE" | "EXPIRED";

function getParallelState(parallelStartTime: string | null | undefined, now: Date): ParallelState {
  if (!parallelStartTime) return "NONE";
  const startTime = new Date(parallelStartTime);
  const endTime = new Date(startTime.getTime() + 9 * 60000);
  if (now < startTime) return "PENDING";
  if (now < endTime) return "LIVE";
  return "EXPIRED";
}

function getCountdownSeconds(parallelStartTime: string | null | undefined, now: Date): number {
  if (!parallelStartTime) return 0;
  const startTime = new Date(parallelStartTime);
  const endTime = new Date(startTime.getTime() + 9 * 60000);
  return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Data Injection Drawer ────────────────────────────────────────────────────

function DataInjectionDrawer({
  isOpen,
  onClose,
  filmTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  filmTitle: string;
}) {
  const { lang } = useI18n();
  const { showToast } = useToast();

  const handleInject = () => {
    showToast(
      lang === "en" ? "You are not on the invitation list." : "您不在邀請名單內。",
      "error"
    );
  };

  const injectTypes = [
    { label: "TEXT", icon: "fa-terminal", color: "#CCFF00" },
    { label: "IMAGE", icon: "fa-image", color: "#00F0FF" },
    { label: "AUDIO", icon: "fa-microphone", color: "#FF6B00" },
    { label: "VIDEO", icon: "fa-video", color: "#FF0080" },
    { label: "BIO", icon: "fa-dna", color: "#9B59B6" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-2xl border border-[#2a2a2a] bg-black pb-10 pt-5 px-5"
        style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #000 100%)", boxShadow: "0 -4px 40px rgba(204,255,0,0.08)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#333]" />
        <div className="mb-1 flex items-center gap-2">
          <i className="fas fa-satellite-dish text-[#CCFF00] text-sm" />
          <span className="font-mono text-[11px] text-[#CCFF00] tracking-[0.2em] uppercase">DATA INJECTION CONSOLE</span>
        </div>
        <p className="font-mono text-[10px] text-[#555] mb-5 tracking-widest uppercase truncate">TARGET: {filmTitle}</p>
        <div className="grid grid-cols-5 gap-3 mb-5">
          {injectTypes.map(({ label, icon, color }) => (
            <button
              key={label}
              onClick={handleInject}
              className="flex flex-col items-center gap-2 rounded-lg border border-[#222] p-3 transition-all active:scale-95 hover:border-[#444]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <i className={`fas ${icon} text-xl`} style={{ color, filter: `drop-shadow(0 0 6px ${color}40)` }} />
              <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color }}>[{label}]</span>
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-[#1a1a1a] bg-[#050505] p-3">
          <p className="font-mono text-[9px] text-[#333] tracking-wider">
            <span className="text-[#CCFF00]">▶ </span>AWAITING AUTHORIZED INJECTOR...
          </p>
          <p className="font-mono text-[9px] text-[#333] tracking-wider mt-1">
            <span className="text-[#FF6B00]">⚠ </span>INVITATION-ONLY ACCESS PROTOCOL ACTIVE
          </p>
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-[#333] py-2.5 font-mono text-[10px] text-[#555] tracking-widest hover:border-[#555] hover:text-[#888] transition-colors">
          [ESC] ABORT INJECTION
        </button>
      </div>
    </div>
  );
}

/** 將 SupabaseFilm 適配成 ModalContext 所需的 Film 類型 */
function toModalFilm(f: SupabaseFilm): Film {
  return {
    id: 0,
    title: f.title,
    creator: f.studio ?? "ANONYMOUS",
    video: buildOssUrl(f.poster_url),
    videoUrl: buildOssUrl(f.trailer_url ?? f.feature_url ?? f.video_url ?? null) || undefined,
    synopsis: f.tech_stack ?? "",
    fullDescription: f.tech_stack ?? "",
    hasInteract: true,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "",
      dir: "",
      tech: f.tech_stack ?? "",
      region: "",
      limits: [],
      onChain: { network: "", contract: "", storage: "", royalty: "" },
    },
  };
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="w-full flex-shrink-0 flex flex-col items-center justify-center bg-black" style={{ height: "100dvh" }}>
      <div className="w-8 h-8 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-[#CCFF00] font-mono text-xs tracking-widest uppercase">Loading Feed</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <i className="fas fa-film text-4xl mb-4 text-[#333]" />
      <span className="text-gray-500 font-mono tracking-widest">NO FILMS FOUND</span>
    </div>
  );
}

// ─── Mobile FeedItem (TikTok) ─────────────────────────────────────────────────

function MobileFeedItem({
  film,
  isMuted,
  onToggleMute,
}: {
  film: SupabaseFilm;
  isMuted: boolean;
  onToggleMute: () => void;
}) {
  const [showUser, setShowUser] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { setActiveModal, setSelectedFilm, setSelectedCreator, setSelectedCreatorUserId } = useModal();
  const { lang } = useI18n();
  const { showToast } = useToast();
  const { authenticated } = usePrivy();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const parallelState = getParallelState(film.parallel_start_time, currentTime);
  const countdownSeconds = parallelState === "LIVE" ? getCountdownSeconds(film.parallel_start_time, currentTime) : 0;

  const handleShare = async () => {
    const shareData = {
      title: film.title,
      text: `Check out "${film.title}" at the Hong Kong AI International Film Festival!`,
      url: typeof window !== "undefined" ? window.location.origin : "",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        showToast(lang === "en" ? "Link copied!" : "鏈接已複製！", "success");
      }
    } catch {}
  };

  const handleParallelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) { showToast(lang === "en" ? "Please connect wallet." : "請先登錄。", "error"); setShowConsent(true); return; }
    setDrawerOpen(true);
  };

  const handleMintToChain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) { showToast(lang === "en" ? "Please connect wallet." : "請先連接錢包。", "error"); setShowConsent(true); return; }
    showToast(lang === "en" ? "Minting coming soon..." : "鏈上鑄造即將上線。", "info");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) setShowUser(diffX > 0);
  };

  const videoSrc = buildOssUrl(film.trailer_url || film.feature_url || film.video_url || null) || undefined;
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const avatarSeed = film.user_avatar_seed ?? film.studio ?? film.id;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <>
      <PrivyLoginWithConsent
        open={showConsent}
        onClose={() => setShowConsent(false)}
      />
      <div
        className={`feed-item${showUser ? " show-user" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="layer-original">
          {/* FeedVideo: HLS 懒加载，滑出视口自动销毁 Hls 实例截断流量 */}
          <FeedVideo
            src={videoSrc}
            poster={posterSrc}
            className="bg-media"
            muted={isMuted}
            visibilityThreshold={0.6}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90 pointer-events-none" />
          <div className="ui-layer">
            <div className="ui-content">
              <div className="ui-left pb-2">
                <div className="tag bg-white text-black text-[10px] font-bold px-2 py-1 inline-block mb-2 rounded-sm">
                  {film.studio ?? "ANONYMOUS"}
                </div>
                <h2 className="font-heavy text-4xl text-white drop-shadow-lg mb-2 leading-none">{film.title}</h2>
                <p className="font-mono text-xs text-gray-300 drop-shadow line-clamp-2 w-full">{film.tech_stack ?? ""}</p>
              </div>
              <div className="ui-right">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <i className={"fas " + (isMuted ? "fa-volume-mute" : "fa-volume-up") + " text-3xl text-white drop-shadow-md"} />
                  <span className="text-[9px] text-white font-mono font-bold">{isMuted ? "UNMUTE" : "MUTED"}</span>
                </button>
                {film.user_id ? (
                  <Link
                    href={`/creator/${encodeURIComponent(film.user_id)}`}
                    className="relative mb-2 active:scale-95 transition-transform flex flex-col items-center outline-none [-webkit-tap-highlight-color:transparent]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={avatarUrl}
                      alt={film.user_display_name ?? film.studio ?? "creator"}
                      className={`w-12 h-12 border-2 rounded-full bg-black shadow-lg
                        ${(film.user_verified_identities ?? []).includes('institution') ? 'border-[#9D00FF] shadow-[0_0_8px_rgba(157,0,255,0.5)]'
                          : (film.user_verified_identities ?? []).includes('creator') ? 'border-signal shadow-[0_0_8px_rgba(204,255,0,0.5)]'
                          : (film.user_verified_identities ?? []).includes('curator') ? 'border-[#FFC107] shadow-[0_0_8px_rgba(255,193,7,0.5)]'
                          : 'border-white'}`}
                    />
                    {(film.user_verified_identities ?? []).length > 0 ? (
                      <IdentityBadges
                        verifiedIdentities={film.user_verified_identities ?? []}
                        variant="dot"
                        avatarOverlay
                      />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-signal absolute -bottom-0.5 -right-0.5 border border-black" />
                    )}
                  </Link>
                ) : (
                  <div className="relative mb-2 flex flex-col items-center">
                    <img src={avatarUrl} alt={film.studio ?? ""} className="w-12 h-12 border-2 border-white rounded-full bg-black shadow-lg" />
                  </div>
                )}
                {parallelState !== "NONE" && (
                  <div className="flex flex-col items-center relative z-20">
                    {parallelState === "EXPIRED" ? (
                      <button className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
                        <i className="fas fa-ban text-3xl text-gray-500" />
                        <span className="text-[9px] text-gray-500 font-mono font-bold mt-1 tracking-wider">EXPIRED</span>
                      </button>
                    ) : parallelState === "PENDING" ? (
                      <button onClick={handleParallelClick} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                        <i className="fas fa-fingerprint text-3xl text-gray-400 drop-shadow-md" />
                        <div className="text-[9px] text-gray-400 border border-gray-600 px-1.5 rounded-sm font-mono font-bold mt-1 tracking-wider">QUEUED</div>
                      </button>
                    ) : (
                      <button onClick={handleParallelClick} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                        <div className="relative">
                          <i className="fas fa-fingerprint text-3xl text-[#CCFF00] drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]" />
                        </div>
                        <div className="text-[9px] text-black bg-[#CCFF00] px-1.5 rounded-sm font-mono font-bold mt-1 tracking-wider">
                          {formatCountdown(countdownSeconds)}
                        </div>
                      </button>
                    )}
                  </div>
                )}
                <div onClick={handleShare} className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="w-10 h-10 bg-black/60 backdrop-blur border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                    <i className="fas fa-share text-sm" />
                  </div>
                  <span className="text-[9px] font-mono">FORWARD</span>
                </div>
                <div
                  onClick={() => { setSelectedFilm(toModalFilm(film)); setActiveModal("info"); }}
                  className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform w-full"
                >
                  <div className="w-10 h-10 bg-black/60 backdrop-blur border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                    <i className="fas fa-info text-sm" />
                  </div>
                  <span className="text-[9px] font-mono text-center">INFO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="layer-user flex flex-col justify-end pb-24 px-4 bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(to top, #000 0%, transparent 50%), url('${posterSrc ?? ""}')` }}
        >
          <div className="user-frame" />
          <h2 className="font-heavy text-4xl text-white mb-1 drop-shadow-md flex items-center gap-2 relative z-10">
            YOUR PARALLEL UNIVERSE
          </h2>
          <p className="font-mono text-xs text-gray-300 mb-4 w-4/5 relative z-10">
            Rendered based on your specific hash: <span className="text-[#CCFF00]">{film.id.slice(0, 8)}</span>
          </p>
          <button onClick={handleMintToChain} className="brutal-btn w-full max-w-xs mt-2 text-sm relative z-10 active:scale-95">
            <i className="fas fa-link mr-2" /> MINT TO CHAIN
          </button>
        </div>
      </div>
      <DataInjectionDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} filmTitle={film.title} />
    </>
  );
}

// ─── Desktop Masonry Card (真正 Midjourney 错落瀑布流) ────────────────────────

// 根据 film.id 哈希值分配 5 种宽高比，形成大小错落的视觉节奏
const ASPECT_RATIOS = [
  "aspect-[2/3]",    // 竖幅 portrait (高)
  "aspect-[3/4]",    // 近竖 portrait
  "aspect-square",   // 正方 square
  "aspect-[4/3]",    // 横幅 landscape
  "aspect-[1/2]",    // 超高 tall poster
];

function DesktopGridCard({ film }: { film: SupabaseFilm }) {
  const { setActiveModal, setSelectedFilm } = useModal();
  const router = useRouter();
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const avatarSeed = film.user_avatar_seed ?? film.studio ?? film.id;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  // 根据 film.id 字符码分配宽高比 → 稳定错落，不随刷新改变
  const aspectClass = ASPECT_RATIOS[
    (film.id.charCodeAt(0) + film.id.charCodeAt(2) + film.id.charCodeAt(4)) % ASPECT_RATIOS.length
  ];
  const aiRatioPct = film.ai_ratio != null ? `${Math.round(film.ai_ratio * 100)}%` : null;
  const liveState = getParallelState(film.parallel_start_time, new Date());

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#0d0d0d] cursor-pointer group w-full ${aspectClass}
                  border border-[#1a1a1a] hover:border-[#CCFF00]/25
                  transition-all duration-300 ease-out`}
      onClick={() => router.push(`/film/${film.id}`)}
    >
      {/* Poster — fills card via object-cover */}
      {posterSrc ? (
        <img
          src={posterSrc}
          alt={film.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#181818] to-[#0a0a0a] flex items-center justify-center">
          <i className="fas fa-film text-[#2a2a2a] text-4xl" />
        </div>
      )}

      {/* Persistent dim gradient at bottom (always visible) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Hover overlay — black scrim slides in */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/75 transition-colors duration-300 rounded-xl pointer-events-none" />

      {/* Hover info — slides up from bottom */}
      <div className="
        absolute inset-x-0 bottom-0 p-3
        opacity-0 group-hover:opacity-100
        translate-y-2 group-hover:translate-y-0
        transition-all duration-300 ease-out
      ">
        {/* Creator row — 点击跳转创作者主页 */}
        {film.user_id ? (
          <Link
            href={`/creator/${encodeURIComponent(film.user_id)}`}
            className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt={film.studio ?? ""}
                className={`w-6 h-6 rounded-full border bg-black
                  ${(film.user_verified_identities ?? []).includes('institution') ? 'border-[#9D00FF]'
                    : (film.user_verified_identities ?? []).includes('creator') ? 'border-signal'
                    : (film.user_verified_identities ?? []).includes('curator') ? 'border-[#FFC107]'
                    : 'border-white/20'}`}
              />
              {(film.user_verified_identities ?? []).length > 0 && (
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-black flex items-center justify-center text-[6px] font-bold
                  ${(film.user_verified_identities ?? []).includes('institution') ? 'bg-[#9D00FF] text-white'
                    : (film.user_verified_identities ?? []).includes('creator') ? 'bg-signal text-black'
                    : 'bg-[#FFC107] text-black'}`}>
                  V
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-gray-300 truncate flex-1">{film.user_display_name ?? film.studio ?? "ANONYMOUS"}</span>
            {(film.user_verified_identities ?? []).length > 0 && (
              <IdentityBadges
                verifiedIdentities={film.user_verified_identities ?? []}
                variant="pill"
                className="shrink-0"
              />
            )}
            {aiRatioPct && (
              <span className="text-[7px] font-mono bg-signal/15 border border-signal/40 text-signal px-1.5 py-0.5 rounded shrink-0 tracking-wider">
                AIF {aiRatioPct}
              </span>
            )}
          </Link>
        ) : (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt={film.studio ?? ""}
                className="w-6 h-6 rounded-full border bg-black border-white/20"
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 truncate flex-1">{film.studio ?? "ANONYMOUS"}</span>
            {aiRatioPct && (
              <span className="text-[7px] font-mono bg-signal/15 border border-signal/40 text-signal px-1.5 py-0.5 rounded shrink-0 tracking-wider">
                AIF {aiRatioPct}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="font-heavy text-sm text-white leading-tight mb-2.5 line-clamp-2">{film.title}</h3>

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 bg-signal text-black text-[9px] font-bold font-mono px-3 py-1.5 rounded-full hover:bg-white transition-colors shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/film/${film.id}`);
            }}
          >
            <i className="fas fa-play text-[8px]" /> PLAY
          </button>
          {film.tech_stack && (
            <span className="text-[8px] font-mono text-[#666] truncate">{film.tech_stack.slice(0, 20)}</span>
          )}
        </div>
      </div>

      {/* Studio tag — always visible, top-left */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded px-1.5 py-0.5
                      text-[8px] font-mono text-gray-400 truncate max-w-[70%] pointer-events-none
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {film.studio ?? "ANON"}
      </div>

      {/* LIVE pulse badge */}
      {liveState === "LIVE" && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-signal text-black text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full animate-pulse pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-black" /> LIVE
        </div>
      )}
    </div>
  );
}

// ─── Desktop Masonry Grid — 真正 CSS columns 瀑布流 ──────────────────────────

function DesktopGrid({ films, searchQuery }: { films: SupabaseFilm[]; searchQuery: string }) {
  const filtered = searchQuery.trim()
    ? films.filter((f) => {
        const q = searchQuery.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          (f.studio ?? "").toLowerCase().includes(q) ||
          (f.tech_stack ?? "").toLowerCase().includes(q)
        );
      })
    : films;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <i className="fas fa-search text-3xl text-[#333]" />
        <span className="text-[#555] font-mono text-xs tracking-widest uppercase">
          No results for &ldquo;{searchQuery}&rdquo;
        </span>
      </div>
    );
  }

  return (
    /* CSS columns = 真正的 Masonry 瀑布流，卡片按宽高比自然错落 */
    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 p-4 pb-8">
      {filtered.map((film) => (
        <div key={film.id} className="break-inside-avoid mb-3">
          <DesktopGridCard film={film} />
        </div>
      ))}
    </div>
  );
}

// ─── Inner Feed (needs useSearchParams — must be wrapped in Suspense) ─────────

function FeedInner() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";

  const [films, setFilms] = useState<SupabaseFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showConsent, setShowConsent] = useState(false);

  const { showToast } = useToast();
  const { lang } = useI18n();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("authRequired") === "1") {
      showToast(lang === "en" ? "Please connect wallet / login first." : "請先登錄或連接錢包。", "error");
      setShowConsent(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleMute = useCallback(() => setIsMuted((prev) => !prev), []);

  const fetchFilms = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("【Feed /api/feed 失敗】:", res.status, body);
        setLoading(false);
        return;
      }
      const { films: data, error } = await res.json();
      if (error) {
        console.error("【Feed 拉取錯誤】:", error);
      } else {
        console.log(`【Feed 抓取到 ${data?.length ?? 0} 部影片】`);
      }
      if (data && data.length > 0) {
        const list = data as SupabaseFilm[];
        const now = new Date();
        const sorted = [...list].sort((a, b) => {
          const p = (s: ParallelState) => (s === "LIVE" ? 0 : s === "PENDING" ? 1 : 2);
          return p(getParallelState(a.parallel_start_time, now)) - p(getParallelState(b.parallel_start_time, now));
        });
        setFilms(sorted);
      } else {
        setFilms([]);
      }
    } catch (err) {
      console.error("【Feed 網絡錯誤】:", err);
    }
    setLoading(false);
  }, []);

  // 首次加載
  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  // 頁面重新可見時（用戶切回標籤頁）立即重新拉取 ── 確保管理員改完開關後用戶能看到最新狀態
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchFilms();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchFilms]);

  // 每 60 秒靜默輪詢，確保長時間停留的用戶也能及時看到上下架變化
  useEffect(() => {
    const timer = setInterval(fetchFilms, 60_000);
    return () => clearInterval(timer);
  }, [fetchFilms]);

  if (loading) return <LoadingSkeleton />;
  if (films.length === 0) return <EmptyState />;

  return (
    <>
      <PrivyLoginWithConsent
        open={showConsent}
        onClose={() => setShowConsent(false)}
      />

      {/* ── Desktop: Masonry Grid (md:+) ── */}
      <div className="hidden md:block w-full min-h-full">
        <DesktopGrid films={films} searchQuery={searchQuery} />
      </div>

      {/* ── Mobile: TikTok vertical feed (<md) ── */}
      <div
        id="feed-scroll"
        className="md:hidden no-scrollbar"
        style={{ height: "100dvh" }}
      >
        {films.map((film) => {
          // 防禦性渲染：跳過 id 或 title 缺失的損壞記錄，避免整個 Feed 白屏崩潰
          if (!film.id || !film.title) return null;
          return (
          <MobileFeedItem
            key={film.id}
            film={film}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
          );
        })}
      </div>
    </>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FeedInner />
    </Suspense>
  );
}
```

### app/upload/page.tsx
```typescript
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';
import CyberLoading from '@/app/components/CyberLoading';
import UniversalCheckout from '@/app/components/UniversalCheckout';
import BackButton from '@/components/BackButton';
import { useProduct } from '@/lib/hooks/useProduct';

type Step = 1 | 2 | 'processing';

// ── Upload Page · Payment UI Helpers (旧版卡片已移除，使用 UniversalCheckout) ──


const TERMINAL_LINES = [
  '> Initializing HKAIIFF 2026 submission protocol...',
  '> Connecting to AIF.BOT broker nodes...',
  '> Node handshake confirmed. Latency: 12ms',
  '> Verifying AI contribution ratio...',
  '> [██░░░░░░░░] 20% — Scanning asset metadata...',
  '> [████░░░░░░] 40% — Uploading poster to ARWEAVE...',
  '> ARWEAVE TX: ar://xK9m2pQw8nR3vL5tY7uZaB4cD1eF6...',
  '> [██████░░░░] 60% — Pinning assets to IPFS cluster...',
  '> IPFS CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqab...',
  '> [████████░░] 80% — Minting NFT metadata on Solana...',
  '> Signing transaction with AIF.BOT vault key...',
  '> [██████████] 100% — TX broadcast confirmed.',
  '> SOL TX HASH: 5v3XkPmNq2aLdBr8cWsY9eM7fHjKoN1pQtUvXyZa4b6',
  '> Registering with HKAIIFF 2026 smart contract...',
  '> ✓ Submission confirmed. Official Selection NFT minted.',
  '> Generating certificate...',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FileUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

/** 获取视频文件时长字符串，如 "2:34" */
function getVideoDurationLabel(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = Math.floor(video.duration);
      const m = Math.floor(d / 60);
      const s = d % 60;
      URL.revokeObjectURL(video.src);
      resolve(`${m}:${s.toString().padStart(2, '0')}`);
    };
    video.onerror = () => resolve('');
    video.src = URL.createObjectURL(file);
  });
}

function UploadContent() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { t } = useI18n();

  const filmIdParam = searchParams.get('film_id');
  console.log('[upload] film_id from params:', filmIdParam);
  console.log('[upload] user_id:', user?.id);

  // ── 頁面級鑒權硬鎖 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/');
    }
  }, [ready, authenticated, router]);

  // ── URL 参数中的 film_id 格式校验（放宽：仅记录警告，不强制重定向）────────
  useEffect(() => {
    const filmId = searchParams.get('film_id');
    const isUUID = filmId ? UUID_REGEX.test(filmId) : false;
    console.log('[upload] film_id 校验 =>', filmId ?? '(无)', '| isUUID =>', filmId ? isUUID : 'n/a');
    if (filmId && !isUUID) {
      // 注意：film_id 不匹配标准 UUID 格式时只警告，不强制跳转
      // Supabase gen_random_uuid() 应始终返回标准 UUID，但本地/测试环境可能不同
      console.warn('[upload] film_id 不是标准 UUID 格式（已放宽校验，继续处理）:', filmId);
    }
  }, [searchParams]);

  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    title: '',
    studio: '',
    techStack: '',
    aiRatio: 0,
    synopsis: '',
    coreCast: '',
    region: '',
    lbsRoyalty: 5,
    contactEmail: '',
  });
  const [posterFile,    setPosterFile]    = useState<File | null>(null);
  const [trailerFile,   setTrailerFile]   = useState<File | null>(null);
  const [filmFile,      setFilmFile]      = useState<File | null>(null);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [uploadStatus,  setUploadStatus]  = useState('');
  const [aifBalance,    setAifBalance]    = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdFilmId, setCreatedFilmId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── 文件预览 & 上传状态（每个文件独立） ────────────────────────────────────
  const [posterPreviewUrl,    setPosterPreviewUrl]    = useState('');
  const [trailerDuration,     setTrailerDuration]     = useState('');
  const [filmDuration,        setFilmDuration]        = useState('');
  const [posterUploadStatus,  setPosterUploadStatus]  = useState<FileUploadStatus>('idle');
  const [trailerUploadStatus, setTrailerUploadStatus] = useState<FileUploadStatus>('idle');
  const [filmUploadStatus,    setFilmUploadStatus]    = useState<FileUploadStatus>('idle');
  const [posterUploadError,   setPosterUploadError]   = useState('');
  const [trailerUploadError,  setTrailerUploadError]  = useState('');
  const [filmUploadError,     setFilmUploadError]     = useState('');

  const { product: filmEntryProduct } = useProduct('film_entry');
  const isSignal = formData.aiRatio >= 51;

  // Terminal printing effect → after completion redirect to /me
  useEffect(() => {
    if (step !== 'processing') return;
    setTerminalLines([]);
    let i = 0;
    const interval = setInterval(() => {
      if (i < TERMINAL_LINES.length) {
        setTerminalLines(prev => [...prev, TERMINAL_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => router.push('/me'), 900);
      }
    }, 320);
    return () => clearInterval(interval);
  }, [step, router]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // 一旦用戶已驗證就拉取 AIF 餘額（無需等到 Step 2 才觸發）
  // 使用 Bearer token API 路由，避免 anon 客户端直接查询 users 表可能的类型不匹配问题
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const token = await getAccessToken();
        if (!token) { setAifBalance(0); return; }
        const res = await fetch('/api/user-balance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json() as { aif_balance?: number };
          setAifBalance(json.aif_balance ?? 0);
        } else {
          console.error('[upload] fetchBalance API error:', res.status);
          setAifBalance(0);
        }
      } catch (err) {
        console.error('[upload] fetchBalance exception:', err);
        setAifBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetchBalance();
  }, [authenticated, user?.id, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const sliderTrackStyle = {
    background: isSignal
      ? `linear-gradient(to right, #CCFF00 ${formData.aiRatio}%, #333 ${formData.aiRatio}%)`
      : `linear-gradient(to right, #FF3333 ${formData.aiRatio}%, #333 ${formData.aiRatio}%)`,
  };

  // ── File validation handlers ──────────────────────────────────────────────

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('err_poster_size'), 'error');
      e.target.value = '';
      return;
    }
    setPosterFile(file);
    setPosterUploadStatus('idle');
    setPosterUploadError('');
    // 生成本地缩略图预览
    const reader = new FileReader();
    reader.onload = (ev) => setPosterPreviewUrl((ev.target?.result as string) ?? '');
    reader.readAsDataURL(file);
  };

  /** 校验视频文件的 MIME type（兜底：若 type 为空则以扩展名判断） */
  const isValidVideoFile = (file: File): boolean => {
    const ACCEPTED_MIME = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/mov'];
    const ACCEPTED_EXT  = /\.(mp4|mov|webm|m4v|qt)$/i;
    return ACCEPTED_MIME.includes(file.type) || file.type.startsWith('video/') || ACCEPTED_EXT.test(file.name);
  };

  const handleTrailerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    console.log(`[upload] handleTrailerChange: name="${file.name}", size=${file.size}, type="${file.type}"`);
    if (!isValidVideoFile(file)) {
      showToast('預告片格式不支援，請上傳 MP4、MOV 或 WebM 格式的影片。', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast(t('err_trailer_size'), 'error');
      e.target.value = '';
      return;
    }
    setTrailerFile(file);
    setTrailerUploadStatus('idle');
    setTrailerUploadError('');
    const dur = await getVideoDurationLabel(file);
    setTrailerDuration(dur);
  };

  const handleFilmChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    console.log(`[upload] handleFilmChange: name="${file.name}", size=${file.size}, type="${file.type}"`);
    if (!isValidVideoFile(file)) {
      showToast('影片格式不支援，請上傳 MP4、MOV 或 WebM 格式的影片。', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024 * 1024) {
      showToast(t('err_film_size'), 'error');
      e.target.value = '';
      return;
    }
    setFilmFile(file);
    setFilmUploadStatus('idle');
    setFilmUploadError('');
    const dur = await getVideoDurationLabel(file);
    setFilmDuration(dur);
  };

  // ── Step navigation ───────────────────────────────────────────────────────

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const goToPayment = () => {
    if (formData.aiRatio < 51) {
      setErrorMsg(t('err_ai_ratio_min'));
      return;
    }
    if (!posterFile || !trailerFile || !filmFile) {
      setErrorMsg(t('err_media_all'));
      return;
    }
    if (!formData.contactEmail.trim() || !EMAIL_RE.test(formData.contactEmail.trim())) {
      setErrorMsg(t('err_contact_email'));
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 視頻直傳 Bunny Stream（瀏覽器 → Bunny CDN，完全不經過 Vercel）
  //
  // 流程：
  //   Step 1  POST /api/upload/video-credential
  //           服務端調用 Bunny API 創建空占位符，返回 videoId + uploadUrl + accessKey
  //   Step 2  XHR PUT <file binary> 直接到 uploadUrl
  //           AccessKey header 由服務端下發，前端不硬編碼任何密鑰
  //   Step 3  成功後返回 HLS URL：https://<cdnHostname>/<videoId>/playlist.m3u8
  // ══════════════════════════════════════════════════════════════════════════
  const uploadVideoDirectly = (
    file: File,
    title?: string,
    statusLabel?: string,
  ): Promise<string> => new Promise((resolve, reject) => {
    (async () => {
      // ── Step 1: 申請上傳憑證 ───────────────────────────────────────────────
      console.log(`[upload] 開始直傳：name="${file.name}", size=${file.size}, type="${file.type || 'unknown'}"`);

      let credRes: Response;
      try {
        credRes = await fetch('/api/upload/video-credential', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ title: title || file.name }),
        });
      } catch (networkErr) {
        throw new Error(`無法連接上傳服務：${(networkErr as Error).message}`);
      }

      // 安全解析響應
      const ct = credRes.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        const raw = await credRes.text();
        throw new Error(`獲取上傳憑證失敗（HTTP ${credRes.status}）：${raw.slice(0, 300)}`);
      }

      const cred = await credRes.json() as {
        success?:     boolean;
        error?:       string;
        videoId?:     string;
        uploadUrl?:   string;
        accessKey?:   string;
        cdnHostname?: string;
      };

      if (!credRes.ok || !cred.success) {
        throw new Error(cred.error ?? `獲取上傳憑證失敗（HTTP ${credRes.status}）`);
      }
      if (!cred.videoId || !cred.uploadUrl || !cred.accessKey || !cred.cdnHostname) {
        throw new Error(`憑證字段不完整：${JSON.stringify({ videoId: !!cred.videoId, uploadUrl: !!cred.uploadUrl, accessKey: !!cred.accessKey, cdn: !!cred.cdnHostname })}`);
      }

      const { videoId, uploadUrl, accessKey, cdnHostname } = cred as Required<typeof cred>;
      console.log(`[upload] 憑證就緒：videoId=${videoId}`);

      // ── Step 2: XHR PUT 二進制流直傳到 Bunny ──────────────────────────────
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('AccessKey', accessKey);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        console.log(`[upload] 進度 ${pct}%`);
        if (statusLabel) setUploadStatus(`${statusLabel} ${pct}%...`);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const hlsUrl = `https://${cdnHostname}/${videoId}/playlist.m3u8`;
          console.log(`[upload] 直傳完成 ✓  HLS=${hlsUrl}`);
          resolve(hlsUrl);
        } else {
          const body = xhr.responseText.slice(0, 300);
          console.error(`[upload] Bunny PUT 失敗 HTTP ${xhr.status}: ${body}`);
          reject(new Error(`影片上傳失敗（HTTP ${xhr.status}）：${body || '未知錯誤'}`));
        }
      };
      xhr.onerror   = () => reject(new Error('影片上傳時發生網絡錯誤，請檢查網絡後重試'));
      xhr.ontimeout = () => reject(new Error('影片上傳超時，請稍後重試'));

      xhr.send(file);
    })().catch(reject);
  });

  // ── 統一上傳入口 ──────────────────────────────────────────────────────────
  // 視頻  → uploadVideoDirectly()  （瀏覽器直傳 Bunny，不經過 Vercel）
  // 圖片  → fetch('/api/upload')   （服務端代理到 Cloudflare R2，小文件安全）
  const uploadFile = async (file: File, title?: string, statusLabel?: string): Promise<string> => {
    if (isValidVideoFile(file)) {
      return uploadVideoDirectly(file, title, statusLabel);
    }

    // 圖片 / 其他靜態資源 → 服務端代理至 Cloudflare R2
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    let res: Response;
    try {
      res = await fetch('/api/upload', {
        method: 'POST',
        body:   fd,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new Error(`上傳超時（${file.name}），請檢查網絡後重試`);
      throw err;
    } finally {
      clearTimeout(timer);
    }

    const ct = res.headers.get('content-type') ?? '';
    let data: { success?: boolean; error?: string; url?: string } = {};
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`伺服器回傳非預期格式（HTTP ${res.status}）：${text.slice(0, 300)}`);
    }
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? `上傳失敗（${file.name}）`);
    }
    return data.url as string;
  };

  // ── 核心上传流程（图片 → R2，视频 → Bunny Stream HLS）────────────────────
  const doUploadAndCreateRecord = async (paymentMethod: 'USD' | 'AIF' | 'pending'): Promise<string> => {
    // ── 海报 → Cloudflare R2 ──────────────────────────────────────────────
    setPosterUploadStatus('uploading');
    setUploadStatus('UPLOADING POSTER TO CLOUDFLARE R2...');
    let posterUrl: string;
    try {
      posterUrl = await uploadFile(posterFile!);
      setPosterUploadStatus('success');
    } catch (err) {
      setPosterUploadStatus('error');
      const msg = (err instanceof Error ? err.message : String(err)) || '海报上传失败';
      setPosterUploadError(msg);
      throw err;
    }

    // ── 预告片 → Bunny Stream（TUS 直傳）────────────────────────────────────
    setTrailerUploadStatus('uploading');
    setUploadStatus('UPLOADING TRAILER TO BUNNY STREAM (DIRECT PUT)...');
    let trailerUrl: string;
    try {
      trailerUrl = await uploadFile(trailerFile!, `${formData.title} - Trailer`, 'UPLOADING TRAILER');
      setTrailerUploadStatus('success');
      setUploadStatus('TRAILER UPLOAD COMPLETE ✓');
    } catch (err) {
      setTrailerUploadStatus('error');
      const msg = (err instanceof Error ? err.message : String(err)) || '预告片上传失败';
      setTrailerUploadError(msg);
      throw err;
    }

    // ── 正片 → Bunny Stream（TUS 直傳）──────────────────────────────────────
    setFilmUploadStatus('uploading');
    setUploadStatus('UPLOADING FULL FILM TO BUNNY STREAM (DIRECT PUT)...');
    let fullFilmUrl: string;
    try {
      fullFilmUrl = await uploadFile(filmFile!, `${formData.title} - Full Film`, 'UPLOADING FILM');
      setFilmUploadStatus('success');
      setUploadStatus('FILM UPLOAD COMPLETE ✓');
    } catch (err) {
      setFilmUploadStatus('error');
      const msg = (err instanceof Error ? err.message : String(err)) || '正片上传失败';
      setFilmUploadError(msg);
      throw err;
    }

    setUploadStatus('MEDIA SECURED. MINTING DATA TO DATABASE...');
    // 获取 Bearer token 用于 API 认证，让服务端可以验证用户身份
    let authToken: string | null = null;
    try {
      authToken = await getAccessToken();
    } catch (tokenErr) {
      console.warn('[upload] 获取 access token 失败:', tokenErr);
    }
    console.log('[upload] doUploadAndCreateRecord user.id:', user!.id, '| hasToken:', !!authToken);

    const dbRes = await fetch('/api/upload-film', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        creator_id:     user!.id,
        title:          formData.title,
        studio_name:    formData.studio,
        tech_stack:     formData.techStack,
        ai_ratio:       formData.aiRatio,
        synopsis:       formData.synopsis,
        core_cast:      formData.coreCast,
        region:         formData.region,
        lbs_royalty:    formData.lbsRoyalty,
        poster_url:     posterUrl,
        trailer_url:    trailerUrl,
        full_film_url:  fullFilmUrl,
        contact_email:  formData.contactEmail.trim().toLowerCase(),
        payment_method: paymentMethod,
      }),
    });

    const dbCt = dbRes.headers.get('content-type') ?? '';
    let data: { success?: boolean; error?: string; film?: { id?: string } } = {};
    if (dbCt.includes('application/json')) {
      data = await dbRes.json();
    } else {
      const text = await dbRes.text();
      throw new Error(`upload-film API 返回非 JSON 格式（HTTP ${dbRes.status}）：${text.slice(0, 300)}`);
    }
    console.log('[upload] upload-film API 完整響應:', JSON.stringify({ success: data.success, filmId: data.film?.id, error: data.error }));
    if (!data.success) {
      const errMsg = data.error ?? 'Submission failed';
      console.error('[upload] upload-film API error:', errMsg);
      throw new Error(errMsg);
    }
    const filmId = data.film?.id;
    if (!filmId) {
      console.error('[upload] film.id 為空！data.film:', JSON.stringify(data.film));
      throw new Error('影片 ID 未能正確取得，請重試（錯誤碼：NULL_FILM_ID）');
    }
    console.log('[upload] ✓ film.id 獲取成功:', filmId);
    return filmId as string;
  };

  // ── 上傳媒體 → 建立 DB 記錄 → 直接彈出結帳視窗（無中轉頁） ───────────────────
  const handleProceedToPayment = async () => {
    if (!authenticated || !user) return;
    // 若已上傳過，僅重新打開彈窗
    if (createdFilmId) {
      setShowCheckoutModal(true);
      return;
    }
    setIsSubmitting(true);
    setPosterUploadStatus('idle');
    setTrailerUploadStatus('idle');
    setFilmUploadStatus('idle');
    setPosterUploadError('');
    setTrailerUploadError('');
    setFilmUploadError('');
    setUploadStatus('INITIALIZING SECURE UPLOAD CHANNEL...');
    try {
      const filmId = await doUploadAndCreateRecord('pending');
      setCreatedFilmId(filmId);
      setShowCheckoutModal(true);
    } catch (err: unknown) {
      const rawMsg = (err instanceof Error ? err.message : String(err)) || 'Upload failed';
      // 将技术性错误转为用户友好的中文提示
      const msg = rawMsg.includes('string did not match') || rawMsg.includes('SCHEMA_MISMATCH')
        ? '影片資料格式有誤，請重新提交。如問題持續請聯繫客服。'
        : rawMsg.includes('DB_COLUMN') || rawMsg.includes('does not exist')
          ? '系統配置異常，請聯繫平台客服。'
          : rawMsg.includes('Missing required') || rawMsg.includes('Missing or invalid')
            ? '請確保所有必填欄位已填寫完整。'
            : rawMsg.includes('AI ratio')
              ? 'AI 比例必須達到 51% 以上。'
              : rawMsg;
      showToast(msg, 'error');
      setErrorMsg(msg);
      setUploadStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const notLoggedIn = !authenticated || !user;

  // ── Render ────────────────────────────────────────────────────────────────

  // Privy 尚未就緒時顯示 Loading，已就緒但未登錄則等待 redirect
  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen pt-28 md:pt-0 pb-32 md:pb-8">
      {/* ── Desktop Page Header ── */}
      <div className="hidden md:flex z-10 bg-[#030303]/95 backdrop-blur border-b border-[#1a1a1a] px-6 py-4 items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-heavy text-2xl text-white tracking-wider leading-none flex items-center gap-2">
            <i className="fas fa-cloud-upload-alt text-signal text-xl" />
            {t('submit_film')}
          </h1>
          <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
            HKAIIFF 2026 · MAY 1 LAUNCH · JULY 11–15 CEREMONY · AI-NATIVE
          </div>
        </div>
        <div className="font-mono text-[9px] text-gray-500 bg-[#111] px-3 py-1.5 rounded border border-[#333]">
          {filmEntryProduct
            ? `ENTRY FEE: $${Number(filmEntryProduct.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD / ${Number(filmEntryProduct.price_aif).toLocaleString()} AIF`
            : 'ENTRY FEE: LOADING…'
          }
        </div>
      </div>

      {/* ── Mobile Page Header ── */}
      <div className="md:hidden px-5 pt-4 pb-3 border-b border-[#1a1a1a]">
        <h1 className="font-heavy text-2xl text-white tracking-wide flex items-center gap-2">
          <i className="fas fa-cloud-upload-alt text-signal" />
          {t('submit_film')}
        </h1>
        <div className="text-[9px] font-mono text-signal tracking-widest mt-0.5">HKAIIFF 2026</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-0">

        {/* ── Step 1: Form (Desktop: 2-col, Mobile: single col) ── */}
        {step === 1 && (
          <div className="animate-fade-in md:grid md:grid-cols-2 md:gap-0 md:items-start">

            {/* ────── LEFT PANEL: Submission Guidelines (Desktop only) ────── */}
            <div className="hidden md:flex flex-col h-full border-r border-[#1a1a1a] px-8 py-8 bg-[#030303] sticky top-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 3.5rem)' }}>
              {/* Hero */}
              <div className="relative rounded-xl overflow-hidden mb-6 aspect-video">
                <img src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800" alt="HKAIIFF" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="font-heavy text-2xl text-white leading-none mb-0.5">HKAIIFF 2026</div>
                  <div className="font-mono text-[9px] text-signal tracking-widest">AI-NATIVE CINEMA · JULY 11–15</div>
                </div>
              </div>

              {/* Requirements */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-list-ul text-signal text-xs" />
                  <span className="font-mono text-[9px] text-signal tracking-[0.2em] uppercase">Submission Requirements</span>
                </div>
                {[
                  { icon: 'fa-microchip', text: '≥ 51% AI-generated content (verified by AIF.BOT)' },
                  { icon: 'fa-image', text: 'Poster: JPG/PNG/WEBP, max 5 MB' },
                  { icon: 'fa-video', text: 'Trailer: MP4/MOV, max 50 MB' },
                  { icon: 'fa-film', text: 'Full Film: MP4/MOV, max 5 GB' },
                  { icon: 'fa-dollar-sign', text: filmEntryProduct ? `Entry fee: $${Number(filmEntryProduct.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD or ${Number(filmEntryProduct.price_aif).toLocaleString()} AIF` : 'Entry fee: loading…' },
                ].map((req) => (
                  <div key={req.text} className="flex items-start gap-2.5 mb-2.5">
                    <div className="w-5 h-5 rounded bg-signal/10 border border-signal/20 flex items-center justify-center shrink-0 mt-0.5">
                      <i className={`fas ${req.icon} text-signal text-[8px]`} />
                    </div>
                    <span className="font-mono text-[10px] text-gray-400 leading-relaxed">{req.text}</span>
                  </div>
                ))}
              </div>

              {/* Copyright Notice */}
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-shield-alt text-signal text-xs" />
                  <span className="font-mono text-[9px] text-signal tracking-wider uppercase">Copyright & IP</span>
                </div>
                <p className="font-mono text-[10px] text-gray-500 leading-relaxed">
                  You retain full copyright ownership. By submitting, you grant HKAIIFF a non-exclusive license to screen
                  your film during the festival period. AI-generated content must comply with the tools&apos; usage policies.
                </p>
              </div>

              {/* AIF Purity Info */}
              <div className="bg-gradient-to-br from-[#0d1a00] to-[#080808] border border-signal/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-signal animate-pulse" />
                  <span className="font-mono text-[9px] text-signal tracking-wider uppercase">AIF Purity Score™</span>
                </div>
                <p className="font-mono text-[10px] text-gray-500 leading-relaxed">
                  The AIF.BOT protocol verifies and records your AI contribution ratio on the Solana blockchain.
                  Films with higher purity scores receive priority in the official selection process.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { val: '7', sub: 'FESTIVAL DAYS' },
                  { val: '51%', sub: 'MIN AI RATIO' },
                  { val: 'SOL', sub: 'ON-CHAIN CERT' },
                ].map((s) => (
                  <div key={s.sub} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
                    <div className="font-heavy text-xl text-signal">{s.val}</div>
                    <div className="font-mono text-[7px] text-gray-600 mt-0.5 tracking-wider">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ────── RIGHT PANEL: Form ────── */}
            <div className="md:px-8 md:py-8 px-4 py-6">
              {/* Mobile notice banner */}
              <div className="md:hidden bg-[#111] border-l-4 border-[#CCFF00] p-4 rounded-xl mb-6">
                <h3 className="font-heavy text-lg text-white mb-1 tracking-wide">HKAIIFF 2026</h3>
                <p className="text-[10px] font-mono text-gray-400 leading-relaxed">{t('up_notice')}</p>
              </div>

            {/* Notice Banner */}
            {/* Old Notice Banner — desktop hides this (left panel already shows it) */}

            <div className="space-y-6 mb-8">

              {/* Project Title */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex justify-between">
                  <span>{t('up_form_title')}</span>
                  <span className="text-danger">*</span>
                </div>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_title')}
                />
              </div>

              {/* Conductor / Studio */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_form_studio')}</div>
                <input
                  type="text"
                  value={formData.studio}
                  onChange={e => setFormData(f => ({ ...f, studio: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_studio')}
                />
              </div>

              {/* Tech Stack */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_form_tech_hint')}</div>
                <input
                  type="text"
                  value={formData.techStack}
                  onChange={e => setFormData(f => ({ ...f, techStack: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_tech')}
                />
              </div>

              {/* AI Contribution Ratio Slider */}
              <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
                <div className="flex justify-between items-end mb-4">
                  <div className="font-mono text-[10px] text-gray-400">{t('up_form_ai_ratio')}</div>
                  <div
                    className="font-heavy text-3xl transition-colors duration-300"
                    style={{ color: isSignal ? '#CCFF00' : '#ffffff' }}
                  >
                    {formData.aiRatio}%
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formData.aiRatio}
                  onChange={e => setFormData(f => ({ ...f, aiRatio: Number(e.target.value) }))}
                  className={isSignal ? 'range-success w-full' : 'range-danger w-full'}
                  style={sliderTrackStyle}
                />
                {!isSignal && (
                  <div className="text-[9px] font-mono text-danger mt-2 flex items-center gap-1">
                    <i className="fas fa-exclamation-triangle" />
                    <span>{t('ai_warn')}</span>
                  </div>
                )}
              </div>

              {/* Synopsis */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_form_synopsis')}</div>
                <textarea
                  value={formData.synopsis}
                  onChange={e => setFormData(f => ({ ...f, synopsis: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none h-28 resize-none transition-colors"
                  placeholder={t('ph_synopsis')}
                />
              </div>

              {/* Core Cast */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_core_cast')}</div>
                <input
                  type="text"
                  value={formData.coreCast}
                  onChange={e => setFormData(f => ({ ...f, coreCast: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_cast')}
                />
              </div>

              {/* Region */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_region')}</div>
                <input
                  type="text"
                  value={formData.region}
                  onChange={e => setFormData(f => ({ ...f, region: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_region')}
                />
              </div>

              {/* LBS Festival Royalty */}
              <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
                <div className="flex justify-between items-end mb-3">
                  <div className="font-mono text-[10px] text-gray-400">{t('up_lbs_royalty')}</div>
                  <div className="font-heavy text-2xl text-signal">{formData.lbsRoyalty}%</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={formData.lbsRoyalty}
                  onChange={e => setFormData(f => ({ ...f, lbsRoyalty: Math.min(50, Math.max(0, Number(e.target.value))) }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-3 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_lbs_royalty')}
                />
                <div className="text-[9px] font-mono text-gray-500 mt-2 flex items-center gap-1.5">
                  <i className="fas fa-info-circle text-signal" />
                  {t('up_lbs_hint')}
                </div>
              </div>

              {/* ── Official Contact Email ── */}
              <div>
                {/* Security Alert Box */}
                <div className="rounded-xl border border-amber-400/50 bg-amber-400/5 p-4 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-shield-alt text-amber-400 text-sm" />
                    <span className="font-mono text-[11px] font-bold text-amber-300 tracking-wide">
                      {t('contactEmail.statementTitle')}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-amber-200/80 leading-relaxed mb-2.5">
                    {t('contactEmail.statementDesc')}
                  </p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] leading-none mt-px">🔒</span>
                    <p className="font-mono text-[9px] text-gray-400 leading-relaxed">
                      {t('contactEmail.privacyNote')}
                    </p>
                  </div>
                </div>
                {/* Label */}
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex justify-between">
                  <span>{t('contactEmail.label')}</span>
                  <span className="text-danger">*</span>
                </div>
                <input
                  type="email"
                  required
                  value={formData.contactEmail}
                  onChange={e => setFormData(f => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-amber-400/30 p-4 rounded-lg text-sm text-white focus:border-amber-400 outline-none transition-colors placeholder-gray-600"
                  placeholder={t('contactEmail.placeholder')}
                />
              </div>

              {/* Assets Upload */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex items-center gap-1.5">
                  {t('up_assets_label')}
                  <span className="text-danger">*</span>
                </div>
                <div className="grid grid-cols-3 gap-3">

                  {/* POSTER — 选中后显示缩略图预览 */}
                  <div className="flex flex-col">
                    <label className={`relative border border-dashed rounded-lg cursor-pointer transition-colors h-28 overflow-hidden flex flex-col items-center justify-center ${
                      posterFile
                        ? 'border-signal bg-signal/5'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePosterChange}
                      />
                      {posterPreviewUrl ? (
                        <>
                          <img src={posterPreviewUrl} alt="poster" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[9px] font-mono tracking-widest">CHANGE</span>
                          </div>
                        </>
                      ) : posterFile ? (
                        <div className="flex flex-col items-center p-2 text-signal">
                          <i className="fas fa-check-circle mb-1.5 text-2xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{posterFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center p-4">
                          <i className="fas fa-image mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_poster_label')}</span>
                        </div>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_poster_spec')}
                    </div>
                  </div>

                  {/* TRAILER — 选中后显示文件名 + 时长 */}
                  <div className="flex flex-col">
                    <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                      trailerFile
                        ? 'border-signal bg-signal/5 text-signal'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        onChange={handleTrailerChange}
                      />
                      {trailerFile ? (
                        <>
                          <i className="fas fa-check-circle mb-1 text-xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center mt-0.5">{trailerFile.name}</span>
                          {trailerDuration && (
                            <span className="text-[7px] font-mono text-signal/60 mt-0.5">
                              <i className="fas fa-clock mr-0.5" />{trailerDuration}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-play-circle mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_trailer_label')}</span>
                        </>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_trailer_spec')}
                    </div>
                  </div>

                  {/* FULL FILM — 选中后显示文件名 + 时长 */}
                  <div className="flex flex-col">
                    <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                      filmFile
                        ? 'border-signal bg-signal/5 text-signal'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        onChange={handleFilmChange}
                      />
                      {filmFile ? (
                        <>
                          <i className="fas fa-check-circle mb-1 text-xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center mt-0.5">{filmFile.name}</span>
                          {filmDuration && (
                            <span className="text-[7px] font-mono text-signal/60 mt-0.5">
                              <i className="fas fa-clock mr-0.5" />{filmDuration}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-video mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_film_label')}</span>
                        </>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_film_spec')}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="text-red-500 text-xs text-center mb-4 animate-pulse">
                {errorMsg}
              </div>
            )}

            {/* Proceed Button */}
            <button
              disabled={!formData.title.trim()}
              onClick={goToPayment}
              className={`brutal-btn w-full text-lg ${!formData.title.trim() ? 'disabled' : ''}`}
            >
              {t('up_submit_btn')} <i className="fas fa-arrow-right ml-2" />
            </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Pre-Payment Confirmation ──────────────────── */}
        {step === 2 && (
          <div className="animate-fade-in max-w-sm mx-auto px-4 py-6">

            {/* Back */}
            <div className="mb-6">
              <BackButton />
            </div>

            {/* Film Summary Badge */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4 mb-4">
              <div className="text-[8px] font-mono text-[#333] tracking-[0.5em] mb-3 uppercase">HKAIIFF 2026 · Submission Review</div>
              <p className="font-black text-white text-lg uppercase tracking-wide truncate mb-3" style={{ fontFamily: 'Oswald, sans-serif' }}>
                {formData.title || '—'}
              </p>
              <div className="grid grid-cols-3 gap-2 border-t border-[#111] pt-3">
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#444] tracking-widest mb-1">AI PURITY</div>
                  <div className={`text-sm font-black font-mono ${isSignal ? 'text-signal' : 'text-orange-400'}`}>
                    {formData.aiRatio}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#444] tracking-widest mb-1">ASSETS</div>
                  <div className="text-sm font-black text-signal font-mono">3 / 3</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#444] tracking-widest mb-1">STATUS</div>
                  <div className="text-sm font-black text-[#CCFF00] font-mono">READY</div>
                </div>
              </div>
            </div>

            {/* Product Info (Dynamic from useProduct) */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4 mb-5">
              <div className="text-[8px] font-mono text-[#333] tracking-[0.5em] mb-3 uppercase">Entry Fee</div>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-white font-black text-base" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    {filmEntryProduct?.name_zh ?? '電影節參展報名費'}
                  </p>
                  <p className="text-[#333] font-mono text-[9px] mt-0.5 tracking-wider">
                    {filmEntryProduct?.name_en ?? 'Film Festival Entry Fee'}
                  </p>
                </div>
                <div className="text-right">
                  {filmEntryProduct ? (
                    <>
                      <p className="text-white font-black font-mono text-lg leading-none">
                        ${Number(filmEntryProduct.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[#00E599] font-mono text-[10px] mt-0.5">
                        / {Number(filmEntryProduct.price_aif).toLocaleString()} AIF
                      </p>
                    </>
                  ) : (
                    <div className="w-20 h-8 bg-[#111] rounded animate-pulse" />
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#111] space-y-1.5 text-[9px] font-mono text-[#333]">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40" />
                  支付後影片自動進入官方審核流程
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40" />
                  支持 Stripe 信用卡 及 AIF 鏈上代幣支付
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#444]/60" />
                  報名費一經支付不予退還 · NON-REFUNDABLE
                </div>
              </div>
            </div>

            {/* Not-logged-in warning */}
            {notLoggedIn && (
              <div className="bg-[#111] border border-danger/50 rounded-xl p-3 mb-4 text-center font-mono text-xs text-danger flex items-center justify-center gap-2">
                <i className="fas fa-lock" /> PLEASE LOGIN FIRST
              </div>
            )}

            {/* Upload progress — 每个文件独立状态卡片 */}
            {isSubmitting && (
              <div className="mb-4">
                <div className="text-[8px] font-mono text-[#333] tracking-[0.3em] mb-2 uppercase">Upload Progress</div>
                <div className="space-y-2">
                  {([
                    { label: 'POSTER',    file: posterFile,  status: posterUploadStatus,  error: posterUploadError,  isVideo: false, duration: '' },
                    { label: 'TRAILER',   file: trailerFile, status: trailerUploadStatus, error: trailerUploadError, isVideo: true,  duration: trailerDuration },
                    { label: 'FULL FILM', file: filmFile,    status: filmUploadStatus,    error: filmUploadError,    isVideo: true,  duration: filmDuration },
                  ] as const).map(({ label, file, status, error, isVideo, duration }) => (
                    <div
                      key={label}
                      className={`bg-[#0a0a0a] border rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors ${
                        status === 'success'  ? 'border-signal/20' :
                        status === 'error'    ? 'border-red-500/20' :
                        status === 'uploading'? 'border-signal/30'  :
                        'border-[#1a1a1a]'
                      }`}
                    >
                      {/* 状态图标 */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        status === 'uploading' ? 'bg-signal/5 border border-signal/30' :
                        status === 'success'   ? 'bg-green-500/15 border border-green-500/30' :
                        status === 'error'     ? 'bg-red-500/15 border border-red-500/30' :
                        'bg-[#111] border border-[#222]'
                      }`}>
                        {status === 'uploading' && (
                          <div className="w-3.5 h-3.5 border border-signal/30 border-t-signal rounded-full animate-spin" />
                        )}
                        {status === 'success' && (
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                          </svg>
                        )}
                        {status === 'error' && (
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                          </svg>
                        )}
                        {status === 'idle' && (
                          <i className={`fas ${isVideo ? 'fa-film' : 'fa-image'} text-[#444] text-[9px]`} />
                        )}
                      </div>
                      {/* 文件信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] font-mono text-[#444] tracking-widest">{label}</div>
                        <div className="text-[9px] font-mono text-white truncate">{file?.name ?? '—'}</div>
                        {isVideo && duration && (
                          <div className="text-[8px] font-mono text-signal/40">
                            <i className="fas fa-clock mr-0.5" />{duration}
                          </div>
                        )}
                        {error && (
                          <div className="text-[8px] font-mono text-red-400 mt-0.5 leading-tight line-clamp-2">{error}</div>
                        )}
                      </div>
                      {/* 状态标签 */}
                      <div className={`text-[8px] font-mono shrink-0 tracking-wider ${
                        status === 'uploading' ? 'text-signal animate-pulse' :
                        status === 'success'   ? 'text-green-400' :
                        status === 'error'     ? 'text-red-400' :
                        'text-[#2a2a2a]'
                      }`}>
                        {status === 'uploading' ? 'UPLOADING…' :
                         status === 'success'   ? 'DONE ✓' :
                         status === 'error'     ? 'FAILED ✗' :
                         'QUEUED'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-[#1a1a1a] tracking-wider text-center mt-3">
                  DO NOT CLOSE THIS PAGE
                </div>
              </div>
            )}

            {/* CTA */}
            {!isSubmitting && (
              <button
                onClick={handleProceedToPayment}
                disabled={notLoggedIn}
                className="w-full py-4 rounded-2xl bg-[#CCFF00] text-black font-black text-sm tracking-widest uppercase
                           hover:bg-[#b8e600] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-[0_0_24px_rgba(204,255,0,0.2)] flex items-center justify-center gap-2 font-mono"
              >
                PROCEED TO PAYMENT
                <i className="fas fa-arrow-right text-xs" />
              </button>
            )}

            <p className="text-[8px] font-mono text-[#1a1a1a] text-center mt-4 tracking-widest">
              SECURED BY STRIPE &amp; SOLANA BLOCKCHAIN · HKAIIFF 2026
            </p>

            {/* 受控模式結帳彈窗：上傳完成後直接彈出，無中轉頁 */}
            {createdFilmId && (
              <UniversalCheckout
                productCode="film_entry"
                extraMetadata={{ filmId: createdFilmId }}
                open={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                onSuccess={() => {
                  setShowCheckoutModal(false);
                }}
                successUrl={typeof window !== 'undefined' ? `${window.location.origin}/success?type=film_entry&amount=500&currency=AIF&name=${encodeURIComponent('影片報名費')}` : `/success?type=film_entry&amount=500&currency=AIF&name=${encodeURIComponent('影片報名費')}`}
                cancelUrl={typeof window !== 'undefined' ? `${window.location.origin}/upload` : '/upload'}
              />
            )}
          </div>
        )}

        {/* ── Step: Processing (Terminal Log) ────────────────── */}
        {step === 'processing' && (
          <div className="animate-fade-in pt-12">
            <div className="w-full h-64 bg-[#050505] border border-[#333] rounded-lg p-4 font-mono text-[10px] text-gray-400 overflow-hidden shadow-inner relative flex flex-col justify-end">
              {/* macOS-style traffic light dots */}
              <div className="absolute top-0 left-0 w-full h-6 bg-[#111] border-b border-[#333] flex items-center px-3 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-danger" />
                <div className="w-2 h-2 rounded-full bg-honey" />
                <div className="w-2 h-2 rounded-full bg-signal" />
              </div>

              {/* Terminal output lines */}
              <div ref={terminalRef} className="space-y-1.5 mt-6 overflow-hidden flex flex-col">
                {terminalLines.map((line, i) => {
                  if (!line) return null;
                  return (
                    <div
                      key={i}
                      className="leading-relaxed"
                      style={{
                        color: line?.startsWith('> ✓') || line?.startsWith('> SOL') ? '#CCFF00' : undefined,
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>

              {/* Blinking cursor */}
              <div className="mt-2 text-signal flex items-center gap-2">
                <i className="fas fa-chevron-right text-[8px]" />
                <span className="cursor-blink">_</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen bg-void" />}>
      <UploadContent />
    </Suspense>
  );
}
```

### app/upload/payment/page.tsx
```typescript
'use client';

/**
 * 已廢棄：影片報名支付流程已縮編至 /upload 的 Step 2，
 * 點擊 PROCEED TO PAYMENT 後直接彈出結帳視窗，無需中轉頁。
 * 此路由保留為重定向，避免舊連結或 Stripe cancel URL 404。
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/upload');
  }, [router]);
  return null;
}
```

### app/me/page.tsx
```typescript
"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import CyberLoading from "@/app/components/CyberLoading";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";

function randomSeed() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}${month}${day} ${hours}:${mins}`;
}

const getStatusUI = (status: string) => {
  switch (status) {
    case 'approved':
      return { color: 'text-signal border-signal bg-signal/10', icon: 'fa-check-circle' };
    case 'rejected':
      return { color: 'text-red-500 border-red-500 bg-red-500/10', icon: 'fa-times-circle' };
    case 'pending':
    default:
      return { color: 'text-yellow-500 border-yellow-500 bg-yellow-500/10', icon: 'fa-hourglass-half' };
  }
};

type TeamMember = { name: string; role: string };

function MePageContent() {
  const { login, ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { createWallet } = useCreateWallet();
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useI18n();
  const { showToast } = useToast();

  // ── 頁面級鑒權硬鎖 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/');
    }
  }, [ready, authenticated, router]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<any | null>(null);

  // ── 已上线 LBS 影展 ────────────────────────────────────────────────────────
  const [onlineLbsNodes, setOnlineLbsNodes] = useState<Array<{
    id: string;
    title: string;
    poster_url: string | null;
  }>>([]);
  // ── 审核通过但未上线的 LBS 影展 ──────────────────────────────────────────
  const [approvedLbsNodes, setApprovedLbsNodes] = useState<Array<{
    id: string;
    title: string;
    poster_url: string | null;
  }>>([]);
  const [interactionHistory, setInteractionHistory] = useState<any[]>([]);

  const [dbProfile, setDbProfile] = useState<{
    agent_id: string;
    name: string;
    display_name: string | null;
    role: string;
    aif_balance: number;
    avatar_seed: string;
    bio: string | null;
    tech_stack: string | null;
    core_team: TeamMember[] | null;
    deposit_address: string | null;
    wallet_index: number | null;
    verification_status: 'unverified' | 'pending' | 'approved' | 'rejected';
    verification_type: 'creator' | 'institution' | 'curator' | null;
    rejection_reason: string | null;
    verified_identities: string[];
    username_locked: boolean;
  } | null>(null);

  /** 用戶所有的身份申請記錄（含多種身份） */
  const [identityApplications, setIdentityApplications] = useState<Array<{
    id: string;
    identity_type: 'creator' | 'institution' | 'curator';
    status: 'awaiting_payment' | 'pending' | 'approved' | 'rejected';
    expires_at: string | null;
    rejection_reason: string | null;
    submitted_at: string;
    verification_name: string | null;
  }>>([]);

  /** 認證按鈕鎖定：有任何 pending 或 approved 未過期的記錄即鎖定 */
  const [isVerifyLocked, setIsVerifyLocked] = useState(false);

  const [displaySolanaAddress, setDisplaySolanaAddress] = useState<string | null>(null);

  // ── Supabase Realtime 狀態 ────────────────────────────────────────────────
  /** WebSocket 是否成功訂閱（用於顯示 LIVE 狀態圓點） */
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  /** 當 aif_balance 發生變化時，短暫閃爍高亮提示用戶 */
  const [aifFlash, setAifFlash] = useState(false);

  // ── 資料加載狀態（區分「加載中」vs「加載完但無數據」，防止永遠卡在 ...） ──
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // ── HD Wallet 充值地址 State ──────────────────────────────────────────────
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [isFetchingDepositAddress, setIsFetchingDepositAddress] = useState(false);

  /**
   * wallet/assign 一次性鎖：防止 syncData useEffect 因 user 對象不穩定
   * 而重複觸發，導致新用戶的充值地址被多次分配（死循環）。
   */
  const walletAssignCalledRef = useRef(false);

  // ── Top-Up Modal State ────────────────────────────────────────────────────
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [copiedFilmId, setCopiedFilmId] = useState<string | null>(null);

  /** 靜默輪詢計時器：TopUp Modal 打開期間每 5 秒自動查帳 */
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 防止多個輪詢請求並發 */
  const isPollingRef = useRef(false);

  const handleTopUpCopy = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      setIsCopied(true);
      showToast(lang === 'en' ? 'Address copied!' : '地址已複製！', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast(lang === 'en' ? 'Failed to copy' : '複製失敗', 'error');
    }
  };

  /**
   * 呼叫 /api/wallet/assign 的統一封裝函數。
   * 在 body 中攜帶 walletAddress，以便後端在用戶行不存在時能自動 upsert 創建。
   * 使用相對路徑，本地開發與生產環境均可正常運作，絕不寫死域名。
   */
  const callAssignWalletApi = async (solanaAddress: string | null): Promise<string | null> => {
    const token = await getAccessToken();
    const res = await fetch('/api/wallet/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        walletAddress: solanaAddress,
      }),
      cache: 'no-store',
    });
    const data = await res.json();
    if (res.ok && data.address) {
      return data.address as string;
    }
    throw new Error(data?.error ?? 'Failed to assign wallet address');
  };

  /**
   * 用戶在 Modal 內主動點擊「生成充值地址」按鈕時觸發。
   */
  const handleGenerateAddress = async () => {
    if (isFetchingDepositAddress) return;
    setIsFetchingDepositAddress(true);
    try {
      const address = await callAssignWalletApi(displaySolanaAddress);
      setDepositAddress(address);
      setDbProfile((prev) => prev ? { ...prev, deposit_address: address } : prev);
      showToast(lang === 'en' ? 'Deposit address generated!' : '專屬充值地址已生成！', 'success');
    } catch (error) {
      console.error('[handleGenerateAddress] error:', error);
      const msg = error instanceof Error ? error.message : (lang === 'en' ? 'Network error, please retry' : '網絡錯誤，請重試');
      showToast(msg, 'error');
    } finally {
      setIsFetchingDepositAddress(false);
    }
  };

  /**
   * TOP UP 按鈕：打開 Modal。
   * - 若 state/DB 中已有地址：直接渲染 QR Code，零等待。
   * - 若完全無地址（極少數情況）：打開 Modal 的同時在背景自動呼叫
   *   /api/wallet/assign，生成完畢後立即渲染 QR Code。
   *   絕不顯示「手動生成」按鈕，用戶無需多點擊一次。
   */
  const handleOpenTopUp = () => {
    // 優先從 dbProfile 同步（避免 state 落後於 DB）
    const resolvedAddress = depositAddress || dbProfile?.deposit_address || null;
    if (resolvedAddress && !depositAddress) {
      setDepositAddress(resolvedAddress);
    }
    setIsTopUpOpen(true);

    // 若完全無地址，在背景自動分配，無需用戶干預
    if (!resolvedAddress && !isFetchingDepositAddress) {
      setIsFetchingDepositAddress(true);
      callAssignWalletApi(displaySolanaAddress)
        .then((address) => {
          setDepositAddress(address);
          setDbProfile((prev) => prev ? { ...prev, deposit_address: address } : prev);
          showToast(lang === 'en' ? 'Deposit address ready!' : '專屬充值地址已就緒！', 'success');
        })
        .catch((err) => {
          console.error('[handleOpenTopUp] auto-assign error:', err);
          const msg = err instanceof Error ? err.message : (lang === 'en' ? 'Network error, please retry' : '網絡錯誤，請重試');
          showToast(msg, 'error');
        })
        .finally(() => setIsFetchingDepositAddress(false));
    }
  };

  /**
   * ATA 初始化觸發器：每次 TopUp Modal 打開且地址存在，必定觸發一次後端確認。
   * 後端 init-ata 有 getAccountInfo 冪等校驗，ATA 已存在時零消耗直接返回。
   * 不設任何前端 useRef 鎖，確保每次打開都能接通後端、輸出 Debug 日誌。
   */
  useEffect(() => {
    if (!isTopUpOpen || !depositAddress) return;

    let cancelled = false;
    const initAta = async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        await fetch('/api/wallet/init-ata', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // 靜默失敗：ATA init 為背景冪等操作，不影響用戶使用
      }
    };

    initAta();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTopUpOpen, depositAddress]);

  /**
   * 靜默自動查帳輪詢：TopUp Modal 打開 + 有充值地址時啟動。
   * 每 5 秒調用一次 /api/wallet/sync-balance。
   * 一旦餘額入帳：立刻清除輪詢、關閉 Modal、閃爍餘額並彈出成功 Toast。
   */
  useEffect(() => {
    if (!isTopUpOpen || !depositAddress) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
      return;
    }

    const pollBalance = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/wallet/sync-balance', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && data.synced === true) {
          // 餘額入帳！清除輪詢，關閉 Modal，更新餘額
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setDbProfile((prev) => prev ? { ...prev, aif_balance: data.aif_balance } : prev);
          setAifFlash(true);
          setTimeout(() => setAifFlash(false), 900);
          setIsTopUpOpen(false);
          showToast(
            lang === 'en'
              ? `+${data.aifAmount} AIF credited! Balance updated.`
              : `+${data.aifAmount} AIF 已入帳！餘額已更新。`,
            'success'
          );
        }
      } catch {
        // 靜默忽略輪詢錯誤，繼續下一輪
      } finally {
        isPollingRef.current = false;
      }
    };

    // 立刻執行一次，再每 5 秒一次
    pollBalance();
    pollingIntervalRef.current = setInterval(pollBalance, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTopUpOpen, depositAddress]);


  // ── Profile Edit Modal State ──────────────────────────────────────────────
  const searchParams = useSearchParams();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarSeed, setEditAvatarSeed] = useState('');
  const [editAboutStudio, setEditAboutStudio] = useState('');
  const [editTechStack, setEditTechStack] = useState('');
  const [editCoreTeam, setEditCoreTeam] = useState<TeamMember[]>([]);

  function openProfileModal() {
    // display_name 优先，其次 name（非默认值），再用 agent_id 兜底
    const nameValue = dbProfile?.display_name
      || (dbProfile?.name && dbProfile.name !== 'New Agent' ? dbProfile.name : '')
      || dbProfile?.agent_id
      || '';
    setEditName(nameValue);
    setEditAvatarSeed(dbProfile?.avatar_seed || user?.id || 'default');
    setEditAboutStudio(dbProfile?.bio || '');
    setEditTechStack(dbProfile?.tech_stack || '');
    setEditCoreTeam(
      Array.isArray(dbProfile?.core_team) ? dbProfile.core_team : []
    );
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
  }

  // 当 URL 带有 ?editProfile=1 时，数据加载完毕后自动弹出编辑弹窗
  // 使用 !isProfileLoading 而非 dbProfile !== null，确保新用户（profile 尚未建立）也能正常弹出
  const autoOpenCalledRef = useRef(false);
  useEffect(() => {
    if (
      !autoOpenCalledRef.current &&
      searchParams?.get('editProfile') === '1' &&
      !isProfileLoading
    ) {
      autoOpenCalledRef.current = true;
      openProfileModal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileLoading, searchParams]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displaySolanaAddress) return;
    try {
      await navigator.clipboard.writeText(displaySolanaAddress);
      showToast(lang === 'en' ? 'Address copied to clipboard!' : '地址已複製！', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast(lang === 'en' ? 'Failed to copy address' : '複製失敗', 'error');
    }
  };

  function addTeamMember() {
    setEditCoreTeam((prev) => [...prev, { name: '', role: '' }]);
  }

  function updateTeamMember(index: number, field: 'name' | 'role', value: string) {
    setEditCoreTeam((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }

  function removeTeamMember(index: number) {
    setEditCoreTeam((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveProfile() {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const filteredCoreTeam = Array.isArray(editCoreTeam)
        ? editCoreTeam.filter((m) => m.name.trim())
        : [];

      // 已認證或審核中時，嚴禁覆寫 display_name（後端由 verification_name 管理）
      const isNameLocked =
        (dbProfile?.verified_identities?.length ?? 0) > 0 ||
        identityApplications.some(
          (a) => a.status === 'pending' || a.status === 'awaiting_payment'
        );

      // 使用服務端 API（Service Role Key）確保寫入真正落庫，繞過 RLS 限制
      const token = await getAccessToken();

      // 嚴格構建 payload：只包含本次 UI 實際可修改的字段，不使用展開運算符
      const profilePayload: Record<string, unknown> = {
        avatar_seed: editAvatarSeed,
        bio: editAboutStudio,
        tech_stack: editTechStack,
        core_team: filteredCoreTeam,
      };
      if (!isNameLocked) {
        profilePayload.display_name = editName;
      }

      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profilePayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error || `HTTP ${res.status}`;
        console.error('❌ Profile save error:', errMsg, errData);
        showToast(`Profile update failed: ${errMsg}`, "error");
      } else {
        const updatedRow = await res.json();
        // 用資料庫返回的真實數據更新本地狀態，避免樂觀更新與實際數據不一致
        setDbProfile((prev) =>
          prev
            ? {
                ...prev,
                ...updatedRow,
                verified_identities: updatedRow.verified_identities ?? prev.verified_identities,
                username_locked: updatedRow.username_locked ?? prev.username_locked,
              }
            : prev
        );
        showToast("Profile updated successfully", "success");
        closeProfileModal();
      }
    } catch (err: any) {
      console.error('❌ handleSaveProfile exception:', err);
      showToast("Something went wrong, please try again", "error");
    } finally {
      setIsSaving(false);
    }
  }

  // 登錄後同步用戶數據到 Supabase，並拉取投稿記錄
  // ⚠️ 依賴陣列使用 user?.id（穩定字串）而非 user 對象，
  //    防止 Privy 每次渲染返回新引用導致此 effect 無限重跑形成死循環。
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    // 重置 wallet assign 鎖（用戶切換時允許重新分配）
    walletAssignCalledRef.current = false;

    const syncData = async () => {
      const userId = user.id;

      // Step 1: 同步基础信息（确保用户行存在），并利用返回值立即初始化余额
      const defaultProfile = {
        agent_id: '',
        name: 'New Agent',
        display_name: null as string | null,
        role: 'human',
        aif_balance: 0,
        avatar_seed: userId,
        bio: null as string | null,
        tech_stack: null as string | null,
        core_team: null as TeamMember[] | null,
        deposit_address: null as string | null,
        wallet_index: null as number | null,
        verification_status: 'unverified' as const,
        verification_type: null as 'creator' | 'institution' | 'curator' | null,
        rejection_reason: null as string | null,
        verified_identities: [] as string[],
        username_locked: false,
      };

      // Step 1: 呼叫 sync-user（Service Role Key，繞過 RLS），取得完整用戶行
      // 注意：客戶端 Supabase 使用 anon key，Privy user ID 非 Supabase auth.uid()，
      // 因此直接用客戶端讀 users 表會因 RLS 失敗。sync-user 用 Service Role 繞過此限制。
      let syncedProfile: Record<string, any> | null = null;
      try {
        const syncRes = await fetch('/api/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user }),
          cache: 'no-store',
        });
        if (syncRes.ok) {
          const rawSync = await syncRes.json();
          if (rawSync && rawSync.id) {
            syncedProfile = rawSync;
            // 用完整行（含 display_name）初始化 profile，避免 RLS 問題導致讀不到 display_name
            setDbProfile({
              agent_id: rawSync.agent_id ?? '',
              name: rawSync.name ?? 'New Agent',
              display_name: rawSync.display_name ?? null,
              role: rawSync.role ?? 'human',
              aif_balance: rawSync.aif_balance ?? 0,
              avatar_seed: rawSync.avatar_seed ?? userId,
              bio: rawSync.bio ?? null,
              tech_stack: rawSync.tech_stack ?? null,
              core_team: rawSync.core_team ?? null,
              deposit_address: rawSync.deposit_address ?? null,
              wallet_index: rawSync.wallet_index ?? null,
              verification_status: (rawSync.verification_status ?? 'unverified') as typeof defaultProfile.verification_status,
              verification_type: rawSync.verification_type ?? null,
              rejection_reason: rawSync.rejection_reason ?? null,
              verified_identities: rawSync.verified_identities ?? [],
              username_locked: rawSync.username_locked ?? false,
            });
          } else if (rawSync && typeof rawSync.aif_balance === 'number') {
            setDbProfile((prev) =>
              prev
                ? { ...prev, aif_balance: rawSync.aif_balance }
                : { ...defaultProfile, aif_balance: rawSync.aif_balance }
            );
          }
        }
      } catch (err) {
        console.error('Failed to sync', err);
      }

      // Step 2: 加載子數據（身份申請 + 鏈上地址分配）
      // creator_applications 未啟用 RLS，客戶端可直接讀取
      // profile 數據已在 Step 1 從 sync-user 取得，此處使用 syncedProfile 變量
      try {
        const profileData = syncedProfile;

        // Step 2a: 加載多重身份申請記錄（含認證名稱）
        const { data: apps } = await supabase
          .from('creator_applications')
          .select('id, identity_type, status, expires_at, rejection_reason, submitted_at, verification_name')
          .eq('user_id', userId)
          .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
          .order('submitted_at', { ascending: false });
        setIdentityApplications(apps ?? []);

        // 計算認證按鈕鎖定狀態：有任何 pending 或 approved 未過期記錄即鎖定
        const nowTs = new Date().toISOString();
        const locked = (apps ?? []).some(
          (a) =>
            a.status === 'pending' ||
            a.status === 'awaiting_payment' ||
            (a.status === 'approved' && (!a.expires_at || a.expires_at > nowTs))
        );
        setIsVerifyLocked(locked);

        // Step 2b: 鏈上地址分配（基於 Step 1 取得的 profileData）
        if (profileData) {
          if (profileData.deposit_address) {
            setDepositAddress(profileData.deposit_address);
          } else if (!profileData.wallet_index && profileData.wallet_index !== 0) {
            // 全新用戶（無 wallet_index）：一次性自動分配充值地址
            if (!walletAssignCalledRef.current) {
              walletAssignCalledRef.current = true;
              try {
                const privyEmbedded = user.linkedAccounts?.find(
                  (acc: any) => acc.type === 'wallet' && acc.walletClientType === 'privy'
                );
                const solanaAddr: string | null = (privyEmbedded as any)?.address ?? null;

                const token = await getAccessToken();
                const res = await fetch('/api/wallet/assign', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ walletAddress: solanaAddr }),
                });
                if (res.ok) {
                  const assignData = await res.json();
                  if (assignData.address) {
                    setDepositAddress(assignData.address);
                    setDbProfile((prev) => prev ? { ...prev, deposit_address: assignData.address } : prev);
                  }
                } else {
                  console.warn('⚠️ Auto-assign deposit address failed, user can generate manually.');
                  walletAssignCalledRef.current = false;
                }
              } catch (assignErr) {
                console.warn('⚠️ Auto-assign exception:', assignErr);
                walletAssignCalledRef.current = false;
              }
            }
          } else {
            // 已有 wallet_index 但 deposit_address 被清空：自動重派生地址（冪等操作）
            if (!walletAssignCalledRef.current) {
              walletAssignCalledRef.current = true;
              try {
                const privyEmbedded = user.linkedAccounts?.find(
                  (acc: any) => acc.type === 'wallet' && acc.walletClientType === 'privy'
                );
                const solanaAddr: string | null = (privyEmbedded as any)?.address ?? null;
                const token = await getAccessToken();
                const res = await fetch('/api/wallet/assign', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ walletAddress: solanaAddr }),
                });
                if (res.ok) {
                  const assignData = await res.json();
                  if (assignData.address) {
                    setDepositAddress(assignData.address);
                    setDbProfile((prev) => prev ? { ...prev, deposit_address: assignData.address } : prev);
                  }
                } else {
                  walletAssignCalledRef.current = false;
                }
              } catch (err) {
                console.warn('[me] Failed to restore deposit address:', err);
                walletAssignCalledRef.current = false;
              }
            }
          }
        }
      } catch (err) {
        console.error('❌ Sub-data fetch exception:', err);
        setDbProfile((prev) => prev ?? { ...defaultProfile, verified_identities: [] });
      } finally {
        setIsProfileLoading(false);
      }

      try {
        const filmsRes = await fetch(`/api/user-films?userId=${userId}`, { cache: 'no-store' });
        const filmsData = await filmsRes.json();
        if (!filmsData.error && Array.isArray(filmsData.films)) {
          setMySubmissions(filmsData.films);
        }
      } catch (err) {
        console.error('Failed to fetch films', err);
      }

      try {
        const { data, error } = await supabase
          .from('interactive_submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Failed to fetch interaction history', error);
        } else {
          setInteractionHistory(data ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch interaction history', err);
      }

      // 加载已上线的 LBS 影展节点
      try {
        const { data: lbsData } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('is_online', true)
          .order('created_at', { ascending: false });
        setOnlineLbsNodes(lbsData ?? []);
      } catch (err) {
        console.error('Failed to fetch online LBS nodes', err);
      }

      // 加载审核通过（但未必上线）的 LBS 影展节点
      // 使用 neq('is_online', true) 而非 eq('is_online', false)，确保 null 值也被包含
      try {
        const { data: approvedData } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('review_status', 'approved')
          .neq('is_online', true)
          .order('created_at', { ascending: false });
        setApprovedLbsNodes(approvedData ?? []);
      } catch (err) {
        console.error('Failed to fetch approved LBS nodes', err);
      }
    };

    syncData();
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── pathname 变化时重新拉取用户 profile + 身份 + LBS 数据（不含钱包分配）──
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const userId = user.id;

    const refreshUserData = async () => {
      try {
        const { data: profileRow } = await supabase
          .from('users')
          .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address, wallet_index, verification_status, verification_type, rejection_reason, verified_identities, username_locked')
          .eq('id', userId)
          .single();
        if (profileRow) {
          setDbProfile((prev) => ({
            ...(prev ?? {
              agent_id: '', name: 'New Agent', display_name: null, role: 'human',
              aif_balance: 0, avatar_seed: userId, bio: null, tech_stack: null,
              core_team: null, deposit_address: null, wallet_index: null,
              verification_status: 'unverified' as const, verification_type: null,
              rejection_reason: null, verified_identities: [], username_locked: false,
            }),
            ...profileRow,
            verified_identities: profileRow.verified_identities ?? [],
            username_locked: profileRow.username_locked ?? false,
          }));
        }
      } catch (err) {
        console.error('[me] refreshUserData profile error:', err);
      }

      try {
        const { data: apps } = await supabase
          .from('creator_applications')
          .select('id, identity_type, status, expires_at, rejection_reason, submitted_at, verification_name')
          .eq('user_id', userId)
          .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
          .order('submitted_at', { ascending: false });
        setIdentityApplications(apps ?? []);
        const nowTs = new Date().toISOString();
        const locked = (apps ?? []).some(
          (a) =>
            a.status === 'pending' ||
            a.status === 'awaiting_payment' ||
            (a.status === 'approved' && (!a.expires_at || a.expires_at > nowTs))
        );
        setIsVerifyLocked(locked);
      } catch (err) {
        console.error('[me] refreshUserData apps error:', err);
      }

      try {
        const { data: lbsOnline } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('is_online', true)
          .order('created_at', { ascending: false });
        setOnlineLbsNodes(lbsOnline ?? []);
      } catch (err) {
        console.error('[me] refreshUserData lbs online error:', err);
      }

      try {
        const { data: lbsApproved } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('review_status', 'approved')
          .neq('is_online', true)
          .order('created_at', { ascending: false });
        setApprovedLbsNodes(lbsApproved ?? []);
      } catch (err) {
        console.error('[me] refreshUserData lbs approved error:', err);
      }
    };

    refreshUserData();
  }, [pathname, authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const embeddedWallet = user.linkedAccounts?.find(
      (acc: any) => acc.type === 'wallet' && acc.walletClientType === 'privy'
    );
    const privyWalletAddress: string | null = (embeddedWallet as any)?.address ?? null;

    if (privyWalletAddress && !privyWalletAddress.startsWith('0x')) {
      setDisplaySolanaAddress(privyWalletAddress);
    } else {
      setDisplaySolanaAddress(null);
    }
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime：監聽整個 users 表 UPDATE，同步所有相關狀態 ──────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const channelName = `me-user-updates-${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (!newData) return;
          setDbProfile((prev) => prev ? {
            ...prev,
            aif_balance: newData.aif_balance ?? prev.aif_balance,
            // 使用 !== undefined 而非 ??，確保 display_name 被清空為 null 時也能正確同步
            display_name: newData.display_name !== undefined ? newData.display_name : prev.display_name,
            verified_identities: newData.verified_identities ?? prev.verified_identities,
            verification_status: newData.verification_status ?? prev.verification_status,
            username_locked: newData.username_locked ?? prev.username_locked,
          } : prev);
          if (typeof newData.aif_balance === 'number') {
            setAifFlash(true);
            setTimeout(() => setAifFlash(false), 900);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    // 組件 unmount 或 user 切換時，銷毀 WebSocket channel，防止內存洩漏
    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 強制從服務端拉取最新 aif_balance（每次掛載或支付回調後呼叫）────────────
  // 使用 /api/sync-user（Service Role Key）確保能繞過 RLS 讀取正確餘額
  const refreshBalance = async () => {
    if (!user?.id) return;
    try {
      const syncRes = await fetch('/api/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
        cache: 'no-store',
      });
      if (!syncRes.ok) {
        console.error('[me] refreshBalance sync-user failed:', syncRes.status);
        return;
      }
      const data = await syncRes.json();
      if (data && typeof data.aif_balance === 'number') {
        setDbProfile((prev) =>
          prev
            ? {
                ...prev,
                aif_balance: data.aif_balance,
                deposit_address: data.deposit_address ?? prev.deposit_address,
                verification_status: data.verification_status ?? prev.verification_status,
                verification_type: data.verification_type ?? prev.verification_type,
                role: data.role ?? prev.role,
                verified_identities: data.verified_identities ?? prev.verified_identities,
              }
            : prev
        );
        setAifFlash(true);
        setTimeout(() => setAifFlash(false), 900);
      }
    } catch (err) {
      console.error('[me] refreshBalance exception:', err);
    }
  };

  // ── 頁面掛載時強制刷新餘額（解決刷新顯示 0 的問題）──────────────────────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    // 延遲 500ms 確保 syncData 已先執行，refreshBalance 再做二次確認
    const timer = setTimeout(() => { refreshBalance(); }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

  // ── Stripe / AIF 支付回調：監聽 URL 參數並顯示 Toast ─────────────────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const url = new URL(window.location.href);
    const paymentParam = url.searchParams.get('payment');
    if (!paymentParam) return;

    // 立即清除 URL 參數，保持網址乾淨
    router.replace('/me', { scroll: false });

    if (paymentParam === 'success') {
      showToast(
        lang === 'zh'
          ? '支付成功！正在更新您的帳戶狀態...'
          : 'Payment successful! Updating your account...',
        'success'
      );
      // 強制刷新餘額與身份狀態
      refreshBalance();
    } else if (paymentParam === 'cancelled' || paymentParam === 'canceled') {
      showToast(
        lang === 'zh' ? '支付已取消' : 'Payment cancelled',
        'error'
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

  // ── 九國語言充值按鈕字典 ─────────────────────────────────────────────────
  const topUpLabels: Record<string, string> = {
    zh: '充值',
    en: 'TOP UP / DEPOSIT',
    ja: 'チャージ',
    ko: '충전',
    th: 'เติมเงิน',
    fr: 'RECHARGER',
    de: 'AUFLADEN',
    es: 'RECARGAR',
    ar: 'تعبئة الرصيد',
  };
  const topUpLabel = topUpLabels[lang] ?? 'TOP UP / DEPOSIT';

  /* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
  // Privy 尚未初始化完成時，渲染空白等待 redirect；已就緒未登錄同樣清空防閃爍
  if (!ready || !authenticated) return null;

  /* ─── AUTHENTICATED VIEW ──────────────────────────────────────────────────── */
  return (
    <div className="flex-1 h-full w-full bg-void flex flex-col relative overflow-y-auto md:overflow-hidden pt-28 md:pt-0 pb-16 md:pb-0 min-h-screen md:min-h-0">
      {isHistoryLoading && <CyberLoading text="LOADING PARALLEL UNIVERSE..." />}

      {/* ── Desktop Page Header (full-width banner) ──────────────────── */}
      <div className="hidden md:flex flex-shrink-0 z-10 bg-[#030303]/95 backdrop-blur border-b border-[#1a1a1a] px-6 py-4 items-center justify-between">
        <div className="hidden md:block">
          <h1 className="font-heavy text-2xl text-white tracking-wider leading-none">
            USER CENTER
          </h1>
          <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
            HKAIIFF · IDENTITY &amp; WALLET
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="hidden md:flex w-8 h-8 rounded-full bg-[#111] border border-[#333] items-center justify-center
                     text-gray-400 hover:text-white hover:border-signal transition-all cursor-pointer"
          title="Sign Out"
        >
          <i className="fas fa-sign-out-alt text-sm" />
        </button>
      </div>

      {/* ═══════ Dashboard Layout: flex-col mobile, flex-row desktop ═══════ */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden md:min-h-0">

        {/* ─── LEFT PANEL: Profile + Wallet (desktop: equal-width half) ─── */}
        <div className="md:flex-1 md:border-r md:border-[#1a1a1a] md:overflow-y-auto md:h-full px-4 md:px-5 md:py-6 py-4">

      {/* ── Profile Card ───────────────────────────────────────────────── */}
      {/* 移動端: flex-col（頭像在上，信息在下）；PC 端: flex-row（左右並排） */}
      <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-5 mb-6 bg-[#111] p-5 rounded-xl border border-[#333] shadow-[0_0_20px_rgba(0,0,0,0.5)]">

        {/* Edit / Logout controls — 絕對定位在右上角 */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
          {/* 編輯按鈕 → 無論是否鎖定均可點擊，進入 Modal 後看鎖定提示 */}
          <button
            onClick={openProfileModal}
            className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-gray-400 hover:text-signal hover:border-signal transition-colors"
            title="Edit Profile"
          >
            <i className="fas fa-edit text-xs" />
          </button>
          {/* 登出按鈕 */}
          <button
            onClick={() => logout()}
            className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 transition-colors"
            title="Logout"
          >
            <i className="fas fa-sign-out-alt text-xs" />
          </button>
        </div>

        {/* Avatar — 移動端水平居中，PC 端靠左 */}
        <div className="flex flex-col items-center md:items-start gap-2 shrink-0 self-center md:self-auto">
          <div className="relative">
            {/* 頭像：邊框顏色根據最高優先身份決定 */}
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${dbProfile?.avatar_seed || user?.id || 'default'}`}
              alt="avatar"
              className={`w-20 h-20 bg-black rounded-full border-2 p-1
                ${(dbProfile?.verified_identities ?? []).includes('institution')
                  ? 'border-[#2563EB] shadow-[0_0_16px_rgba(37,99,235,0.5)]'
                  : (dbProfile?.verified_identities ?? []).includes('creator')
                    ? 'border-[#FFD700] shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                    : (dbProfile?.verified_identities ?? []).includes('curator')
                      ? 'border-[#9333EA] shadow-[0_0_16px_rgba(147,51,234,0.5)]'
                      : 'border-[#444]'
                }`}
            />
            {/* 多重身份認證徽章：X 平台花型，絕對定位在頭像右下角 */}
            {(dbProfile?.verified_identities ?? []).length > 0 && (
              <div className="absolute -bottom-1 -right-1 z-10 flex gap-0.5">
                {(['creator', 'curator', 'institution'] as const).map((id) => {
                  if (!(dbProfile?.verified_identities ?? []).includes(id)) return null;
                  const color = id === 'creator' ? '#FFD700' : id === 'curator' ? '#1D9BF0' : '#829AAB';
                  const title = id === 'creator' ? '認證創作人' : id === 'curator' ? '認證策展人' : '認證機構';
                  return (
                    <span key={id} title={title} className="relative inline-flex items-center justify-center w-5 h-5" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
                      <svg viewBox="0 0 22 22" aria-hidden="true" className="w-5 h-5">
                        <g>
                          <path fill={color} d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.135 2.14 4.735-4.64 1.28 1.313z"/>
                        </g>
                      </svg>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Info — flex-1 min-w-0 保证名字不被挤压 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5 pr-20 md:pr-20">
            <h2 className="font-heavy text-2xl text-white tracking-wide min-w-0 text-center md:text-left">
              {(() => {
                const approvedApp = identityApplications.find(
                  (a) => a.status === 'approved' && a.verification_name
                );
                return (
                  approvedApp?.verification_name ||
                  dbProfile?.display_name ||
                  dbProfile?.name ||
                  (user?.id ? `Agent_${user.id.replace('did:privy:', '').substring(0, 6)}` : 'Agent_SYNCING')
                );
              })()}
            </h2>
            {/* 加V認證標識：已通過任意身份認證時顯示 */}
            {((dbProfile?.verified_identities?.length ?? 0) > 0 || dbProfile?.verification_status === 'approved') && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5 shrink-0"
                aria-label="已認證"
              >
                <circle cx="12" cy="12" r="12" fill="#1DA1F2" />
                <polyline
                  points="6 12 10 16 18 8"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {/* 多重身份認證徽章 */}
            {(dbProfile?.verified_identities ?? []).map((identity) => {
              const cfg = {
                creator: { cls: 'bg-signal/20 text-signal border-signal/40', label: t('verify_badge_creator') },
                institution: { cls: 'bg-[#9D00FF]/20 text-[#9D00FF] border-[#9D00FF]/40', label: t('verify_badge_institution') },
                curator: { cls: 'bg-[#FFC107]/20 text-[#FFC107] border-[#FFC107]/40', label: t('verify_badge_curator') },
              }[identity];
              if (!cfg) return null;
              return (
                <span key={identity} className={`inline-flex items-center gap-1 text-[9px] font-heavy px-2 py-0.5 rounded-full tracking-wider shrink-0 border ${cfg.cls}`}>
                  <i className="fas fa-check-circle text-[8px]" />
                  {cfg.label}
                </span>
              );
            })}
          </div>
          {(dbProfile?.verified_identities?.length ?? 0) === 0 && (
            <div className="mb-2 pr-14">
              <span className="text-[9px] text-gray-400 font-mono tracking-wider uppercase">普通用戶</span>
            </div>
          )}
          {/* Wallet address + Verify button — full width, no padding constraint */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-[#111] border border-[#333] px-3 py-1.5 rounded text-xs text-gray-400 hover:text-signal transition-colors"
            >
              <i className="fa-brands fa-solana text-signal" />
              <span className="font-mono ltr-force">
                {displaySolanaAddress
                  ? `${displaySolanaAddress.slice(0, 4)}...${displaySolanaAddress.slice(-4)}`
                  : 'NO SOL WALLET'}
              </span>
              <i className="far fa-copy"></i>
            </button>

            {/* ── 多重身份狀態 Pills + 認證按鈕 ── */}
            {dbProfile && (() => {
              const pendingApps = identityApplications.filter(
                (a) => a.status === 'pending' || a.status === 'awaiting_payment'
              );

              const pendingPills = pendingApps.map((app) => {
                const label = { creator: '創作人', institution: '機構', curator: '策展人' }[app.identity_type] ?? app.identity_type;
                return (
                  <span key={app.id} className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-neutral-800 text-yellow-400 border border-yellow-700/40 rounded-full px-3 py-1.5 whitespace-nowrap">
                    <i className="fas fa-clock text-[8px]" />
                    {label} 審核中
                  </span>
                );
              });

              return (
                <>
                  {pendingPills}
                  {isVerifyLocked ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-neutral-800/60 text-gray-500 border border-gray-700/40 rounded-full px-4 py-1.5 opacity-50 cursor-not-allowed whitespace-nowrap"
                    >
                      <i className="fas fa-lock text-[8px]" />
                      {lang === 'zh' ? '認證中' : 'In Review'}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/verification')}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white text-black rounded-full px-4 py-1.5 hover:scale-105 transition-transform uppercase tracking-wider whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.15)]"
                    >
                      <i className="fas fa-shield-alt text-[9px]" />
                      {lang === 'zh' ? '立即認證' : t('verify_inline_verify')}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── 退回通知（每個被退回的身份都顯示） ──────────────────────────── */}
      {identityApplications
        .filter((app) => app.status === 'rejected' && app.rejection_reason)
        .map((app) => {
          const typeLabel = { creator: '創作人', institution: '機構', curator: '策展人' }[app.identity_type] ?? app.identity_type;
          return (
            <div key={app.id} className="mb-2 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2.5 flex items-start gap-2">
              <i className="fas fa-exclamation-circle text-red-400 mt-0.5 text-xs shrink-0" />
              <p className="text-red-400 text-[11px] font-mono leading-relaxed">
                <span className="font-bold">[{typeLabel}]</span> {app.rejection_reason}
              </p>
            </div>
          );
        })
      }

      {/* ── LBS Curator Entry Banner ───────────────────────────────────── */}
      {(dbProfile?.verified_identities ?? []).some((id) => id === 'curator' || id === 'institution') && (
        <div className="mb-6">
          {/* 已上线影展横向滚动列表 */}
          {onlineLbsNodes.length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest uppercase mb-2 px-0.5">
                {lang === 'zh' ? '已上线影展' : 'LIVE FESTIVALS'}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {onlineLbsNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => router.push(`/lbs/${node.id}/screenings`)}
                    className="flex-shrink-0 group relative"
                    title={node.title}
                  >
                    <div
                      className="w-16 rounded-xl overflow-hidden border-2 border-[#FFC107]/50 group-hover:border-[#FFC107] transition-all shadow-[0_0_8px_rgba(255,193,7,0.15)] group-hover:shadow-[0_0_16px_rgba(255,193,7,0.35)]"
                      style={{ aspectRatio: '2/3' }}
                    >
                      {node.poster_url ? (
                        <img src={node.poster_url} alt={node.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#111] flex items-center justify-center">
                          <i className="fas fa-map-marker-alt text-[#FFC107]/30 text-lg" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)] animate-pulse" />
                    <p className="text-[9px] text-[#FFC107]/60 font-mono mt-1 w-16 truncate text-center leading-tight">
                      {node.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 审核通过影展横向滚动列表 */}
          {approvedLbsNodes.length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-mono text-green-400/60 tracking-widest uppercase mb-2 px-0.5 flex items-center gap-1.5">
                <i className="fas fa-check-circle text-green-400/60" />
                {lang === 'zh' ? '已通过影展' : 'APPROVED FESTIVALS'}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {approvedLbsNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => router.push(`/lbs/${node.id}/screenings`)}
                    className="flex-shrink-0 group relative"
                    title={node.title}
                  >
                    <div
                      className="w-16 rounded-xl overflow-hidden border-2 border-green-500/50 group-hover:border-green-400 transition-all shadow-[0_0_8px_rgba(74,222,128,0.15)] group-hover:shadow-[0_0_16px_rgba(74,222,128,0.35)]"
                      style={{ aspectRatio: '2/3' }}
                    >
                      {node.poster_url ? (
                        <img src={node.poster_url} alt={node.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#111] flex items-center justify-center">
                          <i className="fas fa-film text-green-400/30 text-lg" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" />
                    <p className="text-[9px] text-green-400/60 font-mono mt-1 w-16 truncate text-center leading-tight">
                      {node.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 新建/提交 Banner */}
          <div
            onClick={() => router.push('/lbs/apply')}
            className="bg-gradient-to-r from-[#111] to-black border border-[#FFC107] hover:border-[#FFC107]/80 transition-all rounded-xl p-5 cursor-pointer group relative overflow-hidden"
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(255,193,7,0.08) 0%, transparent 70%)' }}
            />
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#FFC107]/60 via-[#FFC107]/20 to-transparent pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFC107]/10 border border-[#FFC107]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FFC107]/20 transition-colors">
                  <i className="fas fa-map-marker-alt text-[#FFC107] text-sm" />
                </div>
                <div>
                  <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-0.5 uppercase">
                    {lang === 'zh' ? '策展人 · 專屬通道' : 'CURATOR · EXCLUSIVE'}
                  </div>
                  <div className="font-heavy text-white text-sm tracking-wider">
                    {lang === 'zh' ? 'LBS 影展/影院' : 'LBS FESTIVAL / CINEMA'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {lang === 'zh' ? '新建/提交 LBS 地理位置展映節點申請' : 'New LBS Geolocation Screening Node'}
                  </div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#FFC107] text-sm group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* ── Funding Account Panel ──────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0d1a00] to-[#0a0a0a] p-5 rounded-xl border border-signal/30
                      shadow-[0_0_20px_rgba(204,255,0,0.06)] relative overflow-hidden group mb-4 min-h-[100px] shrink-0">
        {/* Corner glow — pointer-events-none 防止裝飾層攔截按鈕點擊 */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-signal/5 rounded-bl-full transition-colors group-hover:bg-signal/10 pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal/60 via-signal/20 to-transparent pointer-events-none" />

        {/* Label row */}
        <div className="text-[10px] text-signal font-mono tracking-widest flex items-center gap-2 mb-3">
          <i className="fas fa-wallet" />
          FUNDING ACCOUNT
          {/* ── Realtime LIVE 狀態圓點 ── */}
          {!isProfileLoading && (
            <span
              className="flex items-center gap-1"
              title={isRealtimeConnected ? 'Realtime connected · auto-updating' : 'Connecting to realtime...'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-500
                  ${isRealtimeConnected
                    ? 'bg-signal shadow-[0_0_5px_rgba(204,255,0,0.8)] animate-pulse'
                    : 'bg-gray-700'
                  }`}
              />
              <span className={`font-mono text-[8px] tracking-widest transition-colors duration-500
                ${isRealtimeConnected ? 'text-signal/60' : 'text-gray-500'}`}>
                {isRealtimeConnected ? 'LIVE' : 'CONNECTING'}
              </span>
            </span>
          )}
        </div>

        {/* Balance + TOP UP row */}
        <div className="flex flex-row justify-between items-center flex-wrap gap-4 mb-1">
          <div className="flex items-baseline gap-2">
            {/* 數字閃爍：aif_balance 更新時短暫變綠，通知用戶 */}
            <span
              className={`text-4xl font-heavy ltr-force transition-colors duration-300
                ${isProfileLoading
                  ? 'text-gray-500'
                  : aifFlash
                    ? 'text-signal drop-shadow-[0_0_10px_rgba(204,255,0,0.6)]'
                    : 'text-white'
                }`}
            >
              {isProfileLoading
                ? <span className="text-2xl animate-pulse">...</span>
                : (dbProfile?.aif_balance ?? 0).toLocaleString()
              }
            </span>
            {!isProfileLoading && (
              <span className={`text-lg font-heavy transition-colors duration-300
                ${aifFlash ? 'text-signal' : 'text-signal'}`}>
                AIF
              </span>
            )}
          </div>
          <button
            onClick={handleOpenTopUp}
            className="relative z-10 flex items-center gap-1.5 text-[10px] font-heavy tracking-widest
                       bg-signal text-black px-3 py-1.5 rounded-lg
                       shadow-[0_0_12px_rgba(204,255,0,0.4)]
                       hover:shadow-[0_0_20px_rgba(204,255,0,0.6)]
                       active:scale-95 transition-all shrink-0"
          >
            <i className="fas fa-plus text-[9px]" />
            {topUpLabel}
          </button>
        </div>
      </div>
        {/* end LEFT PANEL inner content */}
        </div>

        {/* ─── RIGHT PANEL: Submissions + History (desktop: main content) ─── */}
        <div className="flex-1 md:overflow-y-auto md:h-full px-4 md:px-8 py-4 md:py-6">

      {/* ── My Submissions ─────────────────────────────────────────────── */}
      <h3 className="font-heavy text-xl mb-4 border-b border-[#333] pb-2 text-white flex items-center gap-2">
        <i className="fas fa-film text-gray-500" /> MY SUBMISSIONS
        {mySubmissions.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-signal bg-signal/10 border border-signal/30 px-2 py-0.5 rounded">
            {mySubmissions.length} FILM{mySubmissions.length > 1 ? 'S' : ''}
          </span>
        )}
      </h3>
      <div className="mb-8">
        {mySubmissions.length === 0 ? (
          <div className="text-center text-xs text-gray-500 font-mono py-8 border border-dashed border-[#333] rounded-xl">
            <i className="fas fa-film text-2xl mb-3 block text-gray-700" />
            No submissions yet. Mint your first film.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mySubmissions.map((film) => {
              const filmStatus: string = film?.status || 'pending';
              const statusUI = getStatusUI(filmStatus);
              const STATUS_LABELS: Record<string, string> = {
                approved: 'APPROVED',
                rejected: 'REJECTED',
                pending: 'PENDING',
              };
              const statusLabel = STATUS_LABELS[filmStatus] ?? 'PENDING';
              return (
                <div
                  key={film.id}
                  onClick={() => setSelectedFilm(film)}
                  className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl overflow-hidden
                             hover:border-[#CCFF00]/50 hover:shadow-[0_0_16px_rgba(204,255,0,0.07)]
                             transition-all duration-300 cursor-pointer group"
                >
                  {/* 垂直海報 aspect-[2/3] */}
                  <div className="aspect-[2/3] relative overflow-hidden bg-black">
                    {film?.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt={film?.title || 'FILM'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
                        <i className="fas fa-film text-gray-700 text-2xl" />
                      </div>
                    )}
                    {/* 狀態角標 */}
                    <div className={`absolute top-1.5 right-1.5 border px-1.5 py-0.5 rounded text-[8px] font-mono
                                    flex items-center gap-1 backdrop-blur-sm ${statusUI.color}`}>
                      <i className={`fas ${statusUI.icon} text-[7px]`} />
                      {statusLabel}
                    </div>
                    {/* 底部漸變遮罩 */}
                    <div className="absolute bottom-0 left-0 w-full h-10
                                    bg-gradient-to-t from-[#0f0f0f] to-transparent" />
                  </div>

                  {/* 資訊區塊 */}
                  <div className="p-2.5 space-y-1.5">
                    {/* 片名 */}
                    <div className="font-heavy text-[13px] text-white tracking-wide truncate uppercase leading-tight">
                      {film?.title || 'UNTITLED'}
                    </div>

                    {/* 創作者 */}
                    <div className="text-[10px] text-gray-500 font-mono truncate">
                      {film?.studio || film?.core_cast || dbProfile?.display_name || '—'}
                    </div>

                    {/* 詳細時間 YYYYMMDD HH:mm */}
                    <div className="text-[9px] font-mono text-gray-500 tracking-wider">
                      {film?.created_at ? formatDateTime(film.created_at) : '—'}
                    </div>

                    {/* 流水串號 + 一鍵複製 */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="text-[9px] font-mono text-gray-500 flex-1 truncate tracking-wider">
                        #{(film?.id ?? '').slice(0, 8).toUpperCase()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(film.id ?? '').then(() => {
                            setCopiedFilmId(film.id);
                            showToast(lang === 'en' ? 'Serial ID copied!' : '串號已複製！', 'success');
                            setTimeout(() => setCopiedFilmId(null), 2000);
                          }).catch(() => {
                            showToast(lang === 'en' ? 'Copy failed' : '複製失敗', 'error');
                          });
                        }}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center
                                   text-gray-600 hover:text-signal transition-colors rounded"
                        title="Copy serial ID"
                      >
                        {copiedFilmId === film.id ? (
                          <svg viewBox="0 0 16 16" className="w-3 h-3 text-signal" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Interaction History ────────────────────────────────────────── */}
      <h3 className="font-heavy text-xl mb-4 border-b border-[#333] pb-2 text-white flex items-center gap-2">
        <i className="fas fa-history text-gray-500" /> INTERACTION HISTORY
      </h3>
      <div className="space-y-3 pb-4">
        {interactionHistory.length > 0 ? (
          interactionHistory.map((item) => (
            <div
              key={item.id}
              className="border border-[#222] bg-[#111] rounded-lg p-3 flex gap-4 items-center cursor-pointer hover:border-signal transition-colors active:scale-[0.98]"
              onClick={() => {
                setIsHistoryLoading(true);
                setTimeout(() => setIsHistoryLoading(false), 2000);
              }}
            >
              <img
                src={item.film_cover_url || item.media_url || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200"}
                alt={item.film_title || 'UNKNOWN PROTOCOL'}
                className="w-16 h-12 object-cover rounded border border-[#333]"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-white tracking-wide">{item.film_title || 'UNKNOWN PROTOCOL'}</div>
                <div className="text-[9px] text-signal font-mono mt-1 bg-signal/10 inline-block px-1.5 py-0.5 rounded">
                  Rendered via: {item.inject_type || 'Data'}
                </div>
              </div>
              <button className="text-gray-500 hover:text-white">
                <i className="fas fa-play-circle text-2xl" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center text-xs text-gray-500 font-mono py-8 border border-dashed border-[#333] rounded-xl">
            No interactions yet. Inject data to render universes.
          </div>
        )}
      </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FILM INFO MODAL — APPROVED: 官方參賽證書 / PENDING: 審核中提示
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedFilm && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedFilm(null); }}
        >
          <div className="relative w-full max-w-sm">
            {/* Close button */}
            <button
              onClick={() => setSelectedFilm(null)}
              className="absolute -top-3 -right-3 z-20 w-9 h-9 bg-black border border-[#333] rounded-full
                         flex items-center justify-center text-gray-400 hover:text-white hover:border-[#CCFF00]
                         active:scale-90 transition-all"
            >
              <i className="fas fa-times text-sm" />
            </button>

            {selectedFilm?.status === 'approved' ? (
              /* ── 官方參賽證書 UI (重構版) ───────────────────────────────── */
              <div className="relative bg-[#050505] rounded-xl overflow-hidden shadow-2xl">

                {/* 雙層金邊框架 */}
                <div className="absolute inset-0 rounded-xl border-2 border-[#D4AF37]/50 pointer-events-none z-20" />
                <div className="absolute inset-[6px] rounded-lg border border-[#D4AF37]/25 pointer-events-none z-20" />

                {/* 四角裝飾 */}
                <div className="absolute top-2.5 left-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>
                <div className="absolute top-2.5 right-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>
                <div className="absolute bottom-2.5 left-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>
                <div className="absolute bottom-2.5 right-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>

                {/* 背景水印：徑向漸變 */}
                <div
                  className="absolute inset-0 pointer-events-none select-none"
                  style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(212,175,55,0.08) 0%, transparent 68%)' }}
                />
                {/* 頂部金色細線 */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
                {/* 底部金色細線 */}
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

                <div className="relative z-10 p-8 pb-5">
                  {/* 頂部 Header */}
                  <div className="text-center mb-5">
                    <div className="text-[#D4AF37]/50 font-mono text-[8px] tracking-[0.4em] uppercase mb-1">
                      Hong Kong AI International Film Festival
                    </div>
                    <h3
                      className="text-[#D4AF37] text-3xl tracking-widest uppercase"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      Certificate
                    </h3>
                    <div
                      className="text-[#D4AF37]/60 text-base mt-0.5 tracking-wider"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic' }}
                    >
                      of Official Selection
                    </div>
                    <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent mx-auto mt-3" />
                  </div>

                  {/* 證書正文 */}
                  <div
                    className="text-center leading-relaxed relative z-10 mb-5"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    <p className="text-gray-400 text-sm">This is to certify that the AI-Native Film</p>
                    <p className="text-white text-xl font-bold my-3 uppercase tracking-wide leading-snug">
                      {selectedFilm?.title || 'UNTITLED'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      submitted by{' '}
                      <span className="text-[#CCFF00]">
                        {selectedFilm?.studio || dbProfile?.display_name || 'Unknown Studio'}
                      </span>
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      has been officially selected and approved by the
                    </p>
                    <p className="text-white font-semibold text-sm mt-1">
                      Hong Kong AI International Film Festival Jury
                    </p>
                  </div>

                  {/* 關鍵數據網格 */}
                  <div className="grid grid-cols-3 gap-2 relative z-10 mb-5">
                    <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                      <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">AI RATIO</div>
                      <div className="text-[#CCFF00] font-bold text-base">{selectedFilm?.ai_ratio ?? 0}%</div>
                    </div>
                    <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                      <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">TECH STACK</div>
                      <div className="text-white font-mono text-[9px] leading-tight">
                        {selectedFilm?.tech_stack
                          ? (Array.isArray(selectedFilm.tech_stack)
                              ? selectedFilm.tech_stack[0]
                              : selectedFilm.tech_stack.split(',')[0]?.trim())
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                      <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">DATE</div>
                      <div className="text-white font-mono text-[9px]">
                        {selectedFilm?.created_at
                          ? new Date(selectedFilm.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* 英式紅色印章 + 分享按鈕 同排 */}
                  <div className="flex items-end justify-between gap-3">
                    {/* 分享按鈕 */}
                    <button
                      onClick={async () => {
                        const certUrl = `${window.location.origin}/certificate/${selectedFilm?.id}`;
                        const shareData = {
                          title: `Certificate — ${selectedFilm?.title}`,
                          text: `Official Selection at the Hong Kong AI International Film Festival 🏆`,
                          url: certUrl,
                        };
                        try {
                          if (navigator.share) {
                            await navigator.share(shareData);
                          } else {
                            await navigator.clipboard.writeText(certUrl);
                            showToast('Certificate link copied!', 'success');
                          }
                        } catch {
                          // user cancelled
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 border border-[#D4AF37]/40 text-[#D4AF37] rounded-lg text-xs font-mono tracking-wider hover:bg-[#D4AF37]/10 active:scale-95 transition-all"
                    >
                      <i className="fas fa-share-alt" />
                      SHARE CERTIFICATE
                    </button>

                    {/* 英式傳統紅色印章 SVG */}
                    <div className="w-24 h-24 -rotate-12 opacity-85 select-none pointer-events-none shrink-0">
                      <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const angle = (i * 360) / 24;
                          const rad = (angle * Math.PI) / 180;
                          return (
                            <line
                              key={i}
                              x1={60 + 50 * Math.cos(rad)} y1={60 + 50 * Math.sin(rad)}
                              x2={60 + 57 * Math.cos(rad)} y2={60 + 57 * Math.sin(rad)}
                              stroke="#8B0000" strokeWidth="2.5" strokeLinecap="round"
                            />
                          );
                        })}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#8B0000" strokeWidth="2.5" />
                        <circle cx="60" cy="60" r="42" fill="none" stroke="#8B0000" strokeWidth="1.5" />
                        <circle cx="60" cy="60" r="41" fill="#8B0000" fillOpacity="0.12" />
                        <circle cx="60" cy="60" r="36" fill="none" stroke="#8B0000" strokeWidth="0.8" strokeDasharray="3 2" />
                        <text x="60" y="26" textAnchor="middle" fill="#8B0000" fontSize="12" fontFamily="Georgia, serif">✦</text>
                        <text x="60" y="52" textAnchor="middle" fill="#8B0000" fontSize="8.5" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="2">OFFICIAL</text>
                        <text x="60" y="65" textAnchor="middle" fill="#8B0000" fontSize="11" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="1">SELECTION</text>
                        <line x1="36" y1="70" x2="84" y2="70" stroke="#8B0000" strokeWidth="0.8" />
                        <text x="60" y="81" textAnchor="middle" fill="#8B0000" fontSize="7" fontFamily="Georgia, serif" letterSpacing="1.5">HKAIIFF JURY</text>
                        <text x="60" y="93" textAnchor="middle" fill="#8B0000" fontSize="6.5" fontFamily="Georgia, serif" letterSpacing="2">MMXXV</text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── PENDING / REJECTED 提示 ──────────────────────────────── */
              <div className="relative bg-[#080808] border border-[#333] rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(204,255,0,0.1)]">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-signal" />

                {/* Poster */}
                <div className="relative w-full h-44 overflow-hidden bg-[#0a0a0a]">
                  {selectedFilm?.poster_url ? (
                    <img
                      src={selectedFilm.poster_url}
                      alt={selectedFilm?.title || 'FILM'}
                      className="w-full h-full object-cover opacity-60"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="fas fa-film text-5xl text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4">
                    <h2 className="font-heavy text-xl text-white leading-tight tracking-wide drop-shadow-lg uppercase">
                      {selectedFilm?.title || 'UNTITLED'}
                    </h2>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {selectedFilm?.status === 'rejected' ? (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <i className="fas fa-times-circle text-red-500 text-3xl" />
                      <div className="text-red-500 font-heavy tracking-widest text-sm">NOT SELECTED</div>
                      <p className="text-red-400/80 text-xs font-mono leading-relaxed border border-red-500/30 bg-red-500/10 rounded-lg p-3">
                        This submission was not approved by the jury. A new entry with separate submission fee is required.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 flex items-center justify-center">
                        <i className="fas fa-hourglass-half text-yellow-500 text-xl animate-pulse" />
                      </div>
                      <div className="text-yellow-500 font-heavy tracking-widest text-sm">UNDER REVIEW</div>
                      <p className="text-gray-500 text-xs font-mono leading-relaxed">
                        Your submission is being reviewed by the HKAIIFF jury. You will be notified once a decision is made.
                      </p>
                    </div>
                  )}

                  <div className="text-[9px] font-mono text-gray-500 text-center pt-1">
                    SUBMITTED · {selectedFilm?.created_at
                      ? new Date(selectedFilm.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TOP-UP MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {isTopUpOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsTopUpOpen(false); }}
        >
          <div className="relative w-full sm:max-w-sm bg-[#070707] border border-signal/30 sm:rounded-2xl rounded-t-2xl
                          overflow-hidden shadow-[0_0_60px_rgba(204,255,0,0.15)] flex flex-col">
            {/* Top accent */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal via-signal/50 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
              <div>
                <div className="font-heavy text-base text-white tracking-widest flex items-center gap-2">
                  <i className="fas fa-arrow-down text-signal text-sm" />
                  TOP UP AIF
                </div>
                <div className="text-[9px] font-mono text-signal/70 tracking-widest mt-0.5">
                  DEPOSIT VIA SOLANA NETWORK
                </div>
              </div>
              <button
                onClick={() => setIsTopUpOpen(false)}
                className="w-9 h-9 bg-[#111] border border-[#2a2a2a] rounded-full flex items-center justify-center
                           text-gray-400 hover:text-white hover:border-signal active:scale-90 transition-all"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Warning Banner */}
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-3">
                <i className="fas fa-exclamation-triangle text-amber-400 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-mono text-amber-300/90 leading-relaxed">
                  Please send <span className="text-amber-300 font-bold">ONLY $AIF tokens</span> on the{' '}
                  <span className="text-amber-300 font-bold">Solana network</span> to this address.
                  Other assets will be <span className="text-red-400 font-bold">lost</span>.
                </p>
              </div>

              {/* QR Code 區域 */}
              <div className="flex flex-col items-center gap-3">
                {depositAddress ? (
                  /* ── 已有地址：立刻渲染 QR Code，ATA init 靜默背景執行 ── */
                  (() => {
                    const mintAddr = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
                    if (!mintAddr) {
                      return (
                        <div className="w-full bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-5 flex flex-col items-center gap-2">
                          <i className="fas fa-exclamation-circle text-red-400 text-2xl" />
                          <div className="text-[11px] font-mono text-red-400 font-bold tracking-wider text-center">
                            系統設定錯誤：缺少合約地址
                          </div>
                          <div className="text-[10px] font-mono text-red-400/70 text-center">
                            SYSTEM CONFIG ERROR: Missing AIF_MINT_ADDRESS
                          </div>
                        </div>
                      );
                    }
                    const qrUri = `solana:${depositAddress}?spl-token=${mintAddr}`;
                    return (
                      <>
                        <div className="p-3 bg-white rounded-xl shadow-[0_0_24px_rgba(204,255,0,0.2)]">
                          <QRCode
                            value={qrUri}
                            size={160}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="M"
                          />
                        </div>
                        <div className="text-[9px] font-mono text-gray-500 tracking-wider">
                          SCAN WITH PHANTOM / ANY SOLANA WALLET
                        </div>
                      </>
                    );
                  })()
                ) : isFetchingDepositAddress ? (
                  /* ── 地址分配中：轉圈動畫 ──────────────────────────── */
                  <div className="w-[186px] h-[186px] border-2 border-dashed border-signal/30 rounded-xl flex flex-col items-center justify-center gap-3 bg-signal/5">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-signal/50" />
                    <span className="text-[10px] font-mono text-signal/60 tracking-wider text-center px-4">
                      GENERATING ADDRESS...
                    </span>
                  </div>
                ) : (
                  /* ── 自動生成中（用戶無需操作，handleOpenTopUp 已在背景觸發） ── */
                  <div className="w-[186px] h-[186px] border-2 border-dashed border-signal/30 rounded-xl flex flex-col items-center justify-center gap-3 bg-signal/5">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-signal/50" />
                    <span className="text-[10px] font-mono text-signal/60 tracking-wider text-center px-4">
                      AUTO-GENERATING ADDRESS...
                    </span>
                    <span className="text-[9px] font-mono text-gray-600 text-center px-4">
                      自動生成中，請稍候
                    </span>
                  </div>
                )}
              </div>

              {/* Address Display + Copy（僅在地址存在或加載中時顯示） */}
              {(depositAddress || isFetchingDepositAddress) && (
                <div className="space-y-2">
                  <div className="text-[9px] font-mono text-gray-600 tracking-widest">
                    DEPOSIT ADDRESS
                  </div>
                  <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-3 flex items-center gap-3">
                    {depositAddress ? (
                      <>
                        <span className="font-mono text-[11px] text-signal/90 flex-1 break-all ltr-force leading-relaxed">
                          {depositAddress}
                        </span>
                        <button
                          onClick={handleTopUpCopy}
                          className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center
                                     transition-all active:scale-90
                                     ${isCopied
                                       ? 'bg-signal/20 border-signal text-signal shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                                       : 'bg-[#111] border-[#333] text-gray-400 hover:border-signal hover:text-signal'
                                     }`}
                          title="Copy address"
                        >
                          <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'} text-xs`} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-gray-600 flex-1 flex items-center gap-2">
                        <i className="fas fa-circle-notch fa-spin text-[10px]" />
                        GENERATING DEDICATED ADDRESS...
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer — 顯示靜默輪詢狀態 */}
            <div className="px-5 py-4 border-t border-[#111] bg-[#050505] flex items-center gap-2">
              {depositAddress ? (
                <>
                  <span className="relative flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal/70 animate-ping absolute inline-flex" />
                    <span className="w-1.5 h-1.5 rounded-full bg-signal inline-flex" />
                  </span>
                  <p className="text-[9px] font-mono text-gray-600 leading-relaxed tracking-wide">
                    {lang === 'en' ? 'Auto-checking every 5s. Will credit ' : '每 5 秒自動查帳。入帳後'}
                    <span className="text-signal/70">{lang === 'en' ? 'instantly.' : '立即自動關閉。'}</span>
                  </p>
                </>
              ) : (
                <>
                  <i className="fas fa-circle-notch fa-spin text-signal/50 text-[10px] flex-shrink-0" />
                  <p className="text-[9px] font-mono text-gray-600 leading-relaxed tracking-wide">
                    {lang === 'en' ? 'Generating your dedicated deposit address...' : '正在自動生成您的專屬充值地址...'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PROFILE EDIT MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-[1001] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeProfileModal(); }}
        >
          <div className="relative w-full sm:max-w-lg bg-[#080808] border border-[#2a2a2a] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-[0_0_80px_rgba(204,255,0,0.12)] flex flex-col" style={{ maxHeight: 'min(92vh, calc(100dvh - env(safe-area-inset-bottom) - env(safe-area-inset-top)))' }}>

            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal via-signal/60 to-transparent" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
              <div>
                <div className="font-heavy text-base text-white tracking-wider">EDIT PROFILE</div>
                <div className="text-[9px] font-mono text-signal tracking-widest mt-0.5">
                  {(dbProfile?.verified_identities?.length ?? 0) > 0
                    ? <span className="text-yellow-500 flex items-center gap-1"><i className="fas fa-lock text-[8px]" />已認證用戶 — 名稱欄位已鎖定</span>
                    : identityApplications.some((a) => a.status === 'pending' || a.status === 'awaiting_payment')
                      ? <span className="text-yellow-500 flex items-center gap-1"><i className="fas fa-clock text-[8px]" />認證審核中 — 名稱欄位已鎖定</span>
                      : mySubmissions.length > 0 ? 'BASIC + CREATOR SETTINGS UNLOCKED' : 'BASIC SETTINGS'}
                </div>
              </div>
              <button
                onClick={closeProfileModal}
                className="w-9 h-9 bg-[#111] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-signal active:scale-90 transition-all"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

              {/* ── 死锁横幅：已認證或審核中時顯示 ─────────────────────── */}
              {(() => {
                const isVerified = (dbProfile?.verified_identities?.length ?? 0) > 0;
                const isPending = identityApplications.some(
                  (a) => a.status === 'pending' || a.status === 'awaiting_payment'
                );
                if (!isVerified && !isPending) return null;
                return (
                  <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/40 rounded-xl px-4 py-3.5">
                    <i className="fas fa-lock text-yellow-400 text-base mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-yellow-300 font-bold text-xs tracking-wide mb-1">
                        🔒 核心资料已锁定，不可修改
                      </div>
                      <p className="text-yellow-400/80 text-[11px] font-mono leading-relaxed">
                        您的身份已{isVerified ? '认证' : '提交审核'}，用户名与头像等核心资料已锁定。如需变更，请重新提交身份认证。
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Section: Basic Settings ─────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-signal rounded-full" />
                  <span className="text-[10px] font-mono text-signal tracking-widest">BASIC SETTINGS</span>
                </div>

                {/* Avatar Preview + Randomize */}
                {(() => {
                  const isAvatarLocked =
                    dbProfile?.username_locked === true ||
                    (dbProfile?.verified_identities?.length ?? 0) > 0 ||
                    identityApplications.some(
                      (a) => a.status === 'pending' || a.status === 'awaiting_payment'
                    );
                  return (
                    <div className="flex items-center gap-5 mb-5">
                      <div className="relative shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${editAvatarSeed}`}
                          alt="preview avatar"
                          className={`w-16 h-16 bg-black rounded-full border-2 p-1 ${isAvatarLocked ? 'border-yellow-900/40 opacity-60' : 'border-signal/50'}`}
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center ${isAvatarLocked ? 'bg-yellow-600' : 'bg-signal'}`}>
                          <i className={`fas ${isAvatarLocked ? 'fa-lock' : 'fa-check'} text-[8px] text-black`} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-mono text-gray-500">AVATAR SEED</div>
                        <div className="flex items-center gap-2">
                          <div className={`font-mono text-xs px-2 py-1 rounded tracking-widest ${isAvatarLocked ? 'text-gray-500 bg-gray-800/40 border border-gray-700/30' : 'text-signal bg-signal/10 border border-signal/20'}`}>
                            {editAvatarSeed.substring(0, 10)}
                          </div>
                          <button
                            onClick={() => !isAvatarLocked && setEditAvatarSeed(randomSeed())}
                            disabled={isAvatarLocked}
                            className={`text-[9px] font-mono px-2 py-1 rounded tracking-widest transition-all border
                              ${isAvatarLocked
                                ? 'text-gray-600 border-gray-700/30 bg-gray-800/30 cursor-not-allowed opacity-50'
                                : 'text-signal border-signal/40 bg-signal/10 hover:bg-signal/20 active:scale-95'
                              }`}
                          >
                            <i className={`fas ${isAvatarLocked ? 'fa-lock' : 'fa-random'} mr-1`} />
                            {isAvatarLocked ? 'LOCKED' : 'RANDOMIZE'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Nickname Input */}
                {(() => {
                  const isUsernameLocked = dbProfile?.username_locked === true;
                  const isNameLocked =
                    isUsernameLocked ||
                    (dbProfile?.verified_identities?.length ?? 0) > 0 ||
                    identityApplications.some(
                      (a) => a.status === 'pending' || a.status === 'awaiting_payment'
                    );
                  const lockReason = isUsernameLocked
                    ? '已認證，名稱已鎖定'
                    : (dbProfile?.verified_identities?.length ?? 0) > 0
                      ? '已認證，名稱由認證系統管理'
                      : '認證審核中，暫不可修改';
                  return (
                    <div>
                      <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5 flex items-center gap-1.5">
                        DISPLAY NAME
                        {isNameLocked && (
                          <span className="flex items-center gap-1 text-[9px] text-yellow-500">
                            <i className="fas fa-lock text-[8px]" />
                            {lockReason}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => !isNameLocked && setEditName(e.target.value)}
                        maxLength={40}
                        placeholder="Enter display name..."
                        disabled={isNameLocked}
                        className={`w-full font-mono text-sm px-3 py-2.5 rounded-lg outline-none transition-all
                          ${isNameLocked
                            ? 'bg-gray-100 border border-yellow-900/30 text-gray-500 cursor-not-allowed opacity-60 select-none'
                            : 'bg-[#0d0d0d] border border-[#2a2a2a] text-white focus:border-signal focus:shadow-[0_0_12px_rgba(204,255,0,0.15)] placeholder:text-gray-600'
                          }`}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* ── Section: Creator Advanced Settings (locked if no films) ── */}
              {mySubmissions.length === 0 ? (
                <div className="border border-dashed border-[#2a2a2a] rounded-xl p-5 text-center">
                  <div className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-lock text-gray-600 text-sm" />
                  </div>
                  <div className="text-[11px] font-heavy text-gray-500 tracking-widest mb-1">CREATOR PROFILE LOCKED</div>
                  <div className="text-[10px] font-mono text-gray-500 leading-relaxed">
                    Submit at least one film to unlock<br />advanced creator settings.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-[#00F0FF] rounded-full" />
                    <span className="text-[10px] font-mono text-[#00F0FF] tracking-widest">CREATOR PROFILE</span>
                    <span className="text-[9px] font-mono text-signal bg-signal/10 border border-signal/30 px-1.5 py-0.5 rounded ml-auto">
                      <i className="fas fa-unlock mr-1" />UNLOCKED
                    </span>
                  </div>

                  {/* About Studio */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                      <i className="fas fa-building mr-1 text-[#00F0FF]" />ABOUT STUDIO
                    </label>
                    <textarea
                      value={editAboutStudio}
                      onChange={(e) => setEditAboutStudio(e.target.value)}
                      rows={3}
                      maxLength={400}
                      placeholder="Describe your studio, vision, and creative process..."
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                                 outline-none focus:border-[#00F0FF] focus:shadow-[0_0_12px_rgba(0,240,255,0.12)]
                                 placeholder:text-gray-600 resize-none transition-all leading-relaxed"
                    />
                    <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                      {editAboutStudio.length}/400
                    </div>
                  </div>

                  {/* Tech Stack */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                      <i className="fas fa-microchip mr-1 text-signal" />TECH STACK
                      <span className="text-gray-600 ml-2 normal-case tracking-normal">comma-separated</span>
                    </label>
                    <input
                      type="text"
                      value={editTechStack}
                      onChange={(e) => setEditTechStack(e.target.value)}
                      placeholder="Sora, Midjourney, Suno, RunwayML..."
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                                 outline-none focus:border-signal focus:shadow-[0_0_12px_rgba(204,255,0,0.15)]
                                 placeholder:text-gray-600 transition-all"
                    />
                    {editTechStack && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {editTechStack.split(',').map((tech) => tech.trim()).filter(Boolean).map((tech) => (
                          <span key={tech} className="text-[10px] font-mono text-signal bg-signal/10 border border-signal/20 px-2 py-0.5 rounded">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Core Team */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-mono text-gray-500 tracking-widest">
                        <i className="fas fa-users mr-1 text-[#9D00FF]" />CORE TEAM
                      </label>
                      <button
                        onClick={addTeamMember}
                        className="flex items-center gap-1 text-[9px] font-mono text-signal border border-signal/40 bg-signal/10
                                   px-2 py-1 rounded tracking-widest hover:bg-signal/20 active:scale-95 transition-all"
                      >
                        <i className="fas fa-plus text-[8px]" />ADD MEMBER
                      </button>
                    </div>

                    {editCoreTeam.length === 0 ? (
                      <div className="border border-dashed border-[#222] rounded-lg py-4 text-center text-[10px] font-mono text-gray-500">
                        No team members added yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editCoreTeam.map((member, index) => (
                          <div key={index} className="flex gap-2 items-start bg-[#0d0d0d] border border-[#222] rounded-lg p-3">
                            <div className="flex flex-col gap-2 flex-1">
                              <input
                                type="text"
                                value={member.name}
                                onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                                placeholder="Name"
                                className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                           outline-none focus:border-[#9D00FF] focus:shadow-[0_0_8px_rgba(157,0,255,0.15)]
                                           placeholder:text-gray-600 transition-all w-full"
                              />
                              <input
                                type="text"
                                value={member.role}
                                onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                                placeholder="Role (e.g. Director, Sound Designer)"
                                className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                           outline-none focus:border-[#9D00FF] focus:shadow-[0_0_8px_rgba(157,0,255,0.15)]
                                           placeholder:text-gray-600 transition-all w-full"
                              />
                            </div>
                            <button
                              onClick={() => removeTeamMember(index)}
                              className="w-7 h-7 bg-red-500/10 border border-red-500/30 rounded flex items-center justify-center
                                         text-red-500 hover:bg-red-500/20 active:scale-90 transition-all flex-shrink-0 mt-0.5"
                            >
                              <i className="fas fa-trash-alt text-[10px]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="flex items-center gap-3 px-5 pt-4 pb-4 border-t border-[#1a1a1a] flex-shrink-0 bg-[#080808]"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={closeProfileModal}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-[#111] text-gray-300 font-heavy text-[11px] rounded-lg tracking-widest
                           border border-[#333] hover:border-white hover:text-white active:scale-95 transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CANCEL
              </button>
              {(() => {
                const isUsernameLocked = dbProfile?.username_locked === true;
                const isNameLocked =
                  isUsernameLocked ||
                  (dbProfile?.verified_identities?.length ?? 0) > 0 ||
                  identityApplications.some(
                    (a) => a.status === 'pending' || a.status === 'awaiting_payment'
                  );
                const isFullyVerified = (dbProfile?.verified_identities?.length ?? 0) > 0;

                if (isNameLocked) {
                  return (
                    <button
                      disabled
                      className="flex-[2] py-2.5 bg-gray-800/60 text-gray-500 font-heavy text-[11px] rounded-lg tracking-widest
                                 border border-yellow-900/40 cursor-not-allowed opacity-70 flex items-center justify-center gap-1.5"
                    >
                      <i className="fas fa-lock text-yellow-600 text-[10px]" />
                      {isUsernameLocked ? '🔒 已認證，名稱已鎖定' : isFullyVerified ? '🔒 身份已認證，資料已鎖定' : '🔒 審核中，資料已鎖定'}
                    </button>
                  );
                }

                return (
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-[2] py-2.5 bg-signal text-black font-heavy text-[11px] rounded-lg tracking-widest
                               shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(204,255,0,0.45)]
                               active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <><i className="fas fa-spinner fa-spin mr-1.5" />SAVING...</>
                    ) : (
                      <><i className="fas fa-check mr-1.5" />SAVE PROFILE</>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-signal">Loading...</div>}>
      <MePageContent />
    </Suspense>
  );
}
```

### app/film/[id]/page.tsx
```typescript
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { buildOssUrl } from '@/lib/utils/oss';
import FeedVideo from '@/components/FeedVideo';
import IdentityBadges from '@/app/components/IdentityBadges';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmDetail {
  id: string;
  title: string;
  studio: string | null;
  tech_stack: string | null;
  ai_ratio: number | null;
  poster_url: string | null;
  trailer_url: string | null;
  synopsis: string | null;
  user_id: string | null;
}

interface CreatorProfile {
  id: string;
  display_name: string | null;
  name: string;
  avatar_seed: string | null;
  bio: string | null;
  verified_identities: string[];
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function FilmDetailSkeleton() {
  return (
    <div className="min-h-screen bg-black animate-pulse">
      <div className="w-full aspect-video bg-[#111]" />
      <div className="px-4 md:px-8 py-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-[#1a1a1a] rounded w-3/4" />
        <div className="h-4 bg-[#1a1a1a] rounded w-1/4" />
        <div className="h-4 bg-[#1a1a1a] rounded w-full" />
        <div className="h-4 bg-[#1a1a1a] rounded w-5/6" />
      </div>
    </div>
  );
}

// ─── Creator Card ─────────────────────────────────────────────────────────────

function CreatorCard({ creator }: { creator: CreatorProfile }) {
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(creator.avatar_seed ?? creator.id)}`;
  const topIdentity = creator.verified_identities.includes('institution')
    ? 'institution'
    : creator.verified_identities.includes('creator')
    ? 'creator'
    : creator.verified_identities.includes('curator')
    ? 'curator'
    : null;

  const borderColor = topIdentity === 'institution'
    ? 'border-[#9D00FF] shadow-[0_0_12px_rgba(157,0,255,0.35)]'
    : topIdentity === 'creator'
    ? 'border-signal shadow-[0_0_12px_rgba(204,255,0,0.35)]'
    : topIdentity === 'curator'
    ? 'border-[#FFC107] shadow-[0_0_12px_rgba(255,193,7,0.35)]'
    : 'border-[#333]';

  const displayName = creator.display_name || creator.name;

  return (
    <Link
      href={`/creator/${creator.id}`}
      className="flex items-center gap-4 bg-[#0d0d0d] border border-[#222] hover:border-[#444] rounded-2xl p-4 md:p-5 transition-all duration-200 group active:scale-[0.98]"
    >
      {/* 大 V 頭像 */}
      <div className="relative shrink-0">
        <img
          src={avatarUrl}
          alt={displayName}
          className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 bg-black p-0.5 ${borderColor}`}
        />
        {creator.verified_identities.length > 0 && (
          <div className="absolute -bottom-1 -right-1 z-10">
            <IdentityBadges
              verifiedIdentities={creator.verified_identities}
              variant="dot"
              avatarOverlay
            />
          </div>
        )}
      </div>

      {/* 創作者資訊 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-heavy text-white text-base md:text-lg truncate">{displayName}</span>
          {creator.verified_identities.length > 0 && (
            <IdentityBadges
              verifiedIdentities={creator.verified_identities}
              variant="pill"
              className="shrink-0"
            />
          )}
        </div>
        {creator.bio && (
          <p className="text-xs text-gray-500 font-mono line-clamp-2 leading-relaxed">{creator.bio}</p>
        )}
        <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-[#555] group-hover:text-signal transition-colors">
          <span>查看創作者主頁</span>
          <i className="fas fa-arrow-right text-[8px]" />
        </div>
      </div>

      <i className="fas fa-chevron-right text-[#333] group-hover:text-signal transition-colors shrink-0" />
    </Link>
  );
}

// ─── Film Detail Inner ────────────────────────────────────────────────────────

function FilmDetailInner() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchFilm() {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, studio, tech_stack, ai_ratio, poster_url, trailer_url, synopsis, user_id')
          .eq('id', id)
          .single();

        if (error || !data) {
          setLoading(false);
          return;
        }

        setFilm(data as FilmDetail);

        if (data.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, display_name, name, avatar_seed, bio, verified_identities')
            .eq('id', data.user_id)
            .single();

          if (userData) {
            setCreator({
              ...userData,
              verified_identities: userData.verified_identities ?? [],
            });
          }
        }
      } catch (err) {
        console.error('[FilmDetail] fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFilm();
  }, [id]);

  if (loading) return <FilmDetailSkeleton />;

  if (!film) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6">
        <i className="fas fa-exclamation-triangle text-3xl text-[#333]" />
        <p className="text-gray-500 font-mono text-sm text-center">影片不存在或已下架</p>
        <button
          onClick={() => router.back()}
          className="text-signal font-mono text-xs border border-signal px-5 py-2 rounded-full active:scale-95 transition-transform"
        >
          <i className="fas fa-arrow-left mr-2" />返回
        </button>
      </div>
    );
  }

  const trailerSrc = buildOssUrl(film.trailer_url) || undefined;
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const aiRatioPct = film.ai_ratio != null ? `${Math.round(film.ai_ratio * 100)}%` : null;

  return (
    <div className="min-h-screen bg-black pb-32 md:pb-16">

      {/* ── 返回按鈕（懸浮在視頻上方）── */}
      <button
        onClick={() => router.back()}
        className="fixed top-5 left-4 z-50 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:border-signal hover:text-signal transition-all active:scale-90 shadow-lg"
        aria-label="返回"
      >
        <i className="fas fa-arrow-left text-sm" />
      </button>

      {/* ── 預告片視頻區（頂部全寬）── */}
      <div className="w-full bg-black">
        {trailerSrc ? (
          <div className="w-full aspect-video md:aspect-[21/9] max-h-[70vh] overflow-hidden relative">
            <FeedVideo
              src={trailerSrc}
              poster={posterSrc}
              className="w-full h-full object-contain bg-black"
              muted={false}
              visibilityThreshold={0.2}
            />
          </div>
        ) : (
          <div className="w-full aspect-video md:aspect-[21/9] max-h-[70vh] overflow-hidden relative bg-[#0a0a0a]">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={film.title}
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-film text-5xl text-[#222]" />
            </div>
          </div>
        )}
      </div>

      {/* ── 內容資訊區 ── */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* 標籤列 */}
        <div className="flex flex-wrap items-center gap-2">
          {aiRatioPct && (
            <span className="text-[10px] font-mono bg-signal/15 border border-signal/40 text-signal px-2.5 py-1 rounded-full tracking-wider">
              AIF {aiRatioPct}
            </span>
          )}
          {film.studio && (
            <span className="text-[10px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
              {film.studio}
            </span>
          )}
          {film.tech_stack && (
            <span className="text-[10px] font-mono bg-[#111] border border-[#222] text-gray-500 px-2.5 py-1 rounded-full">
              {film.tech_stack}
            </span>
          )}
        </div>

        {/* 標題 */}
        <h1 className="font-heavy text-3xl md:text-4xl text-white leading-tight">{film.title}</h1>

        {/* 劇情簡介 */}
        {(film.synopsis || film.tech_stack) && (
          <section>
            <h2 className="font-heavy text-sm text-[#555] tracking-widest uppercase mb-3">SYNOPSIS</h2>
            <p className="text-sm md:text-base text-gray-300 leading-relaxed border-l-2 border-[#333] pl-4">
              {film.synopsis || film.tech_stack}
            </p>
          </section>
        )}

        {/* 分隔線 */}
        <div className="border-t border-[#1a1a1a]" />

        {/* ── 創作者專屬展位 ── */}
        {creator && (
          <section>
            <h2 className="font-heavy text-sm text-[#555] tracking-widest uppercase mb-3">CREATOR</h2>
            <CreatorCard creator={creator} />
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

export default function FilmDetailPage() {
  return (
    <Suspense fallback={<FilmDetailSkeleton />}>
      <FilmDetailInner />
    </Suspense>
  );
}
```

### app/verification/page.tsx
```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { useModal } from "@/app/context/ModalContext";
import { supabase } from "@/lib/supabase";
import UniversalCheckout from "@/app/components/UniversalCheckout";
import { useProduct } from "@/lib/hooks/useProduct";

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationType = "creator" | "institution" | "curator";

/** 三態：A=未提交 B=審核中 C=已通過 */
type VerifyPageState = "A" | "B" | "C";

interface VerificationForm {
  verificationType: VerificationType | null;
  /** 認證名稱 = users.display_name，全平台唯一 */
  verificationName: string;
  bio: string;
  aboutStudio: string;
  techStack: string;
  docUrl: string;
  docFileName: string;
}

interface IdentityApp {
  id: string;
  identity_type: VerificationType;
  status: "awaiting_payment" | "pending" | "approved" | "rejected";
  verification_name: string | null;
  expires_at: string | null;
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className={`flex flex-col items-center ${i < total - 1 ? "flex-1" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-heavy border transition-all
              ${i + 1 < current ? "bg-signal border-signal text-black" :
                i + 1 === current ? "bg-signal border-signal text-black shadow-[0_0_12px_rgba(204,255,0,0.4)]" :
                "bg-[#111] border-[#333] text-gray-600"}`}>
              {i + 1 < current ? <i className="fas fa-check text-[9px]" /> : i + 1}
            </div>
            <span className={`text-[8px] font-mono mt-1 tracking-wider whitespace-nowrap
              ${i + 1 === current ? "text-signal" : i + 1 < current ? "text-gray-400" : "text-gray-700"}`}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`h-px flex-1 mx-1 mt-[-12px] transition-colors ${i + 1 < current ? "bg-signal/50" : "bg-[#222]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── ResubmitWarningModal ──────────────────────────────────────────────────────
function ResubmitWarningModal({
  lang,
  onCancel,
  onConfirm,
}: {
  lang: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-[#0d0d0d] border border-[#333] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-base font-heavy text-white mb-3">
          ⚠️ {lang === "zh" ? "重新提交將清除原認證" : "Resubmitting Will Clear Current Verification"}
        </h3>
        <p className="text-[11px] font-mono text-gray-400 leading-relaxed mb-6">
          {lang === "zh"
            ? "重新提交認證將導致當前認證記錄失效，認證名稱將被釋放，需重新付費審核。確認繼續？"
            : "Resubmitting will invalidate your current verification record. Your verification name will be released and a new fee will be required. Continue?"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#333] text-gray-400 font-mono text-xs tracking-widest rounded-xl hover:border-[#555] hover:text-white transition-all"
          >
            {lang === "zh" ? "取消" : "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500/20 border border-red-500/50 text-red-400 font-mono text-xs tracking-widest rounded-xl hover:bg-red-500/30 transition-all"
          >
            {lang === "zh" ? "確認，重新提交" : "Confirm & Resubmit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VerificationPage() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const { setActiveModal } = useModal();
  const docInputRef = useRef<HTMLInputElement>(null);

  const { product: verifyProduct } = useProduct("identity_verify");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [aifBalance, setAifBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showResubmitWarning, setShowResubmitWarning] = useState(false);

  /** 三態狀態 */
  const [pageState, setPageState] = useState<VerifyPageState>("A");
  /** 審核中 / 已通過的申請列表 */
  const [statusApps, setStatusApps] = useState<IdentityApp[]>([]);
  /** 已有申請的身份類型（blocked types） */
  const [blockedTypes, setBlockedTypes] = useState<VerificationType[]>([]);

  const [form, setForm] = useState<VerificationForm>({
    verificationType: null,
    verificationName: "",
    bio: "",
    aboutStudio: "",
    techStack: "",
    docUrl: "",
    docFileName: "",
  });

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  // 加載 AIF 餘額、用戶資料、申請狀態
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetch_ = async () => {
      setIsLoadingBalance(true);
      try {
        // 取得 AIF 餘額 + display_name + bio + about_studio + tech_stack
        const { data: userData } = await supabase
          .from("users")
          .select("aif_balance, verified_identities, display_name, bio, about_studio, tech_stack")
          .eq("id", user.id)
          .single();

        setAifBalance(userData?.aif_balance ?? 0);

        // 用 users 表資料預填表單（verificationName = display_name）
        setForm((prev) => ({
          ...prev,
          verificationName: userData?.display_name ?? "",
          bio: userData?.bio ?? "",
          aboutStudio: userData?.about_studio ?? "",
          techStack: userData?.tech_stack ?? "",
        }));

        // 查詢最新申請記錄
        const now = new Date().toISOString();
        const { data: existingApps } = await supabase
          .from("creator_applications")
          .select("id, identity_type, status, verification_name, expires_at")
          .eq("user_id", user.id)
          .in("status", ["awaiting_payment", "pending", "approved"])
          .order("submitted_at", { ascending: false });

        const apps: IdentityApp[] = (existingApps ?? []) as IdentityApp[];
        setStatusApps(apps);

        // 規則一：只要有任何 pending 或 approved 未過期記錄，整個頁面鎖定
        const hasAnyPending = apps.some(
          (a) => a.status === "pending" || a.status === "awaiting_payment"
        );
        const hasAnyApproved = apps.some(
          (a) => a.status === "approved" && (!a.expires_at || a.expires_at > now)
        );

        if (hasAnyPending || hasAnyApproved) {
          setBlockedTypes(["creator", "institution", "curator"]);
        }

        // 狀態判斷：C = 有已通過未過期；B = 有審核中；A = 無活躍記錄
        if (hasAnyApproved) {
          setPageState("C");
        } else if (hasAnyPending) {
          setPageState("B");
        } else {
          setPageState("A");
        }
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetch_();
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateForm<K extends keyof VerificationForm>(key: K, value: VerificationForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────

  function validateStep1(): boolean {
    if (!form.verificationType) {
      showToast(lang === "zh" ? "請選擇身份類型" : "Please select an identity type", "error");
      return false;
    }
    return true;
  }

  /**
   * Step 1 下一步：
   * 1. 校驗認證名稱全平台唯一性
   * 2. 將所有字段（display_name / bio / about_studio / tech_stack）UPDATE 到 users 表
   * 3. 進入 Step 2
   */
  async function handleStep1Next() {
    if (!validateStep1()) return;
    if (!user?.id) return;

    const trimmedName = form.verificationName.trim();
    if (!trimmedName) {
      showToast(
        lang === "zh" ? "認證名稱不能為空" : "Verification name is required",
        "error"
      );
      return;
    }

    // 全平台唯一性校驗
    const { data: nameCheck } = await supabase
      .from("users")
      .select("id")
      .eq("display_name", trimmedName)
      .neq("id", user.id)
      .maybeSingle();

    if (nameCheck) {
      showToast(
        lang === "zh"
          ? "此認證名稱已被其他用戶使用，請更換"
          : "This name is already taken, please choose another",
        "error"
      );
      return;
    }

    setIsSavingProfile(true);
    try {
      await supabase
        .from("users")
        .update({
          display_name: trimmedName,
          bio: form.bio.trim() || null,
          about_studio: form.aboutStudio.trim() || null,
          tech_stack: form.techStack.trim() || null,
        })
        .eq("id", user.id);
    } catch (err) {
      console.error("[verification] failed to save profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
    setStep(2);
  }

  // ── OSS Document Upload ────────────────────────────────────────────────────

  async function handleDocUpload(file: File) {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast(lang === "zh" ? "文件大小不能超過 5MB" : "File must be under 5MB", "error");
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      showToast(lang === "zh" ? "只支持圖片或 PDF 格式" : "Only images or PDF allowed", "error");
      return;
    }
    setIsDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "上传失败");
      }
      const data = await res.json();
      if (!data.success || !data.url) throw new Error("上传未返回有效 URL");
      updateForm("docUrl", data.url as string);
      updateForm("docFileName", file.name);
      showToast(lang === "zh" ? "文件上傳成功！" : "File uploaded!", "success");
    } catch (err) {
      console.error("[doc upload]", err);
      showToast(lang === "zh" ? "上傳失敗，請重試" : "Upload failed, please retry", "error");
    } finally {
      setIsDocUploading(false);
    }
  }

  /**
   * 提交認證申請（僅用於 Stripe fiat 支付回調）
   * AIF 支付由後端 /api/pay/internal-checkout 直接寫入，前端只需更新狀態。
   */
  async function submitVerification(paymentMethod: "fiat" | "aif", token: string) {
    const res = await fetch("/api/verification/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        verificationType: form.verificationType,
        verificationName: form.verificationName,
        paymentMethod,
        applicationId: draftApplicationId ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.message ?? data.error ?? "Submission failed";
      showToast(msg, "error");
      return;
    }
    showToast(t("verify_success"), "success");
    setPageState("B");
  }

  /**
   * 進入 Step 2 時，先保存草稿（fiat 支付流程預建草稿，Stripe Webhook 升級狀態用）
   */
  useEffect(() => {
    if (step !== 2 || !authenticated || !user?.id || isSavingDraft || draftApplicationId) return;

    const saveDraft = async () => {
      setIsSavingDraft(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch("/api/verification/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verificationType: form.verificationType,
            verificationName: form.verificationName,
            paymentMethod: "fiat",
          }),
        });
        const data = await res.json();
        if (res.ok && data.applicationId) {
          setDraftApplicationId(data.applicationId);
          localStorage.setItem("pending_verification", JSON.stringify({
            ...form,
            paymentMethod: "fiat",
            applicationId: data.applicationId,
          }));
        }
      } catch (err) {
        console.error("[verification] failed to save draft:", err);
      } finally {
        setIsSavingDraft(false);
      }
    };

    saveDraft();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle return from Stripe ──────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href);
    const stripeSuccess = url.searchParams.get("stripe_success");
    const stripeCancelled = url.searchParams.get("stripe_cancelled");

    if (stripeSuccess === "1" && authenticated && user?.id) {
      router.replace("/verification", { scroll: false });
      const pending = localStorage.getItem("pending_verification");
      if (pending) {
        localStorage.removeItem("pending_verification");
        showToast(
          lang === "zh" ? "Stripe 支付成功！正在提交認證申請..." : "Payment successful! Submitting your application...",
          "success"
        );
        getAccessToken().then((token) => {
          if (token) submitVerification("fiat", token);
        });
      } else {
        showToast(
          lang === "zh" ? "支付成功！您的認證申請已提交。" : "Payment successful! Your verification has been submitted.",
          "success"
        );
        setPageState("B");
      }
    } else if (stripeCancelled === "1") {
      router.replace("/verification", { scroll: false });
      showToast(
        lang === "zh" ? "支付已取消，您可以重新選擇支付方式" : "Payment cancelled. You can try again.",
        "error"
      );
    }
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 重新提交：確認後重置表單 ───────────────────────────────────────────────

  function handleResubmitConfirm() {
    setShowResubmitWarning(false);
    setPageState("A");
    setStep(1);
    setDraftApplicationId(null);
    setBlockedTypes([]);
    setForm((prev) => ({
      ...prev,
      verificationType: null,
      docUrl: "",
      docFileName: "",
    }));
  }

  if (!ready || !authenticated) return null;

  const stepLabels = [t("verify_step1"), t("verify_step2"), t("verify_step3")];

  const IDENTITY_TYPES: Array<{ value: VerificationType; icon: string }> = [
    { value: "creator", icon: "fa-film" },
    { value: "institution", icon: "fa-building" },
    { value: "curator", icon: "fa-palette" },
  ];

  const typeLabel = (ty: string) =>
    ({ creator: "創作人", institution: "機構", curator: "策展人" }[ty] ?? ty);

  // ── 狀態 B：審核中 ────────────────────────────────────────────────────────
  if (pageState === "B" && !isLoadingBalance) {
    const pendingApps = statusApps.filter(
      (a) => a.status === "pending" || a.status === "awaiting_payment"
    );
    return (
      <>
        {showResubmitWarning && (
          <ResubmitWarningModal
            lang={lang}
            onCancel={() => setShowResubmitWarning(false)}
            onConfirm={handleResubmitConfirm}
          />
        )}
        <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
            <button
              onClick={() => setActiveModal("lang")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur border border-[#444] text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg"
            >
              <i className="fas fa-globe text-sm" />
            </button>
          </div>
        </div>
        <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-8 text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-yellow-500/10 border-2 border-yellow-500/40 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.2)]">
                <i className="fas fa-clock text-yellow-400 text-5xl" />
              </div>
              <div className="absolute inset-0 rounded-full border border-yellow-500/20 animate-ping" />
            </div>
            <div className="space-y-3">
              <h2 className="font-heavy text-3xl text-white tracking-wider">
                {lang === "zh" ? "審核中" : "UNDER REVIEW"}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 tracking-widest leading-relaxed max-w-xs">
                {lang === "zh"
                  ? "您的認證申請已提交，審核團隊將在 3-5 個工作日內完成審核。"
                  : "Your application has been submitted. Our team will review it within 3-5 business days."}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[9px] font-mono text-yellow-400/60 tracking-widest">
                  {lang === "zh" ? "審核進行中" : "IN REVIEW"}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              </div>
            </div>

            {/* 審核中的申請列表 */}
            {pendingApps.length > 0 && (
              <div className="w-full space-y-2">
                {pendingApps.map((app) => (
                  <div key={app.id} className="bg-[#0d0d0d] border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-[10px] font-mono text-gray-500 mb-0.5">
                        {typeLabel(app.identity_type)}
                      </div>
                      {app.verification_name && (
                        <div className="text-sm font-heavy text-white">{app.verification_name}</div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full px-3 py-1.5">
                      <i className="fas fa-clock text-[8px]" />
                      {lang === "zh" ? "審核中" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 重新提交按鈕（帶警告） */}
            <button
              onClick={() => setShowResubmitWarning(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-500 font-mono text-xs tracking-widest rounded-xl hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all"
            >
              <i className="fas fa-redo text-[10px]" />
              {lang === "zh" ? "重新提交認證" : "Resubmit Verification"}
            </button>

            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)] active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {lang === "zh" ? "返回個人頁" : "Back to Profile"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── 狀態 C：已通過 ────────────────────────────────────────────────────────
  if (pageState === "C" && !isLoadingBalance) {
    return (
      <>
        {showResubmitWarning && (
          <ResubmitWarningModal
            lang={lang}
            onCancel={() => setShowResubmitWarning(false)}
            onConfirm={handleResubmitConfirm}
          />
        )}
        <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
            <button
              onClick={() => setActiveModal("lang")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur border border-[#444] text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg"
            >
              <i className="fas fa-globe text-sm" />
            </button>
          </div>
        </div>
        <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-8 text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-signal/10 border-2 border-signal/40 flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.2)]">
                <i className="fas fa-shield-alt text-signal text-5xl" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="font-heavy text-3xl text-white tracking-wider">
                {lang === "zh" ? "認證已完成" : "VERIFIED"}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 tracking-widest leading-relaxed max-w-xs">
                {lang === "zh"
                  ? "您的身份認證已通過，以下為已認證的身份資訊（只讀）。"
                  : "Your identity verification is approved. The information below is read-only."}
              </p>
            </div>

            {/* 已通過的申請列表（只讀） */}
            <div className="w-full space-y-2">
              {statusApps
                .filter((a) => a.status === "approved")
                .map((app) => (
                  <div key={app.id} className="bg-[#0d0d0d] border border-signal/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-[10px] font-mono text-gray-500 mb-0.5">
                        {typeLabel(app.identity_type)}
                      </div>
                      {app.verification_name && (
                        <div className="text-sm font-heavy text-white">{app.verification_name}</div>
                      )}
                      {app.expires_at && (
                        <div className="text-[9px] font-mono text-gray-600 mt-0.5">
                          {lang === "zh" ? "效期至" : "Expires"}{" "}
                          {new Date(app.expires_at).toLocaleDateString("zh-TW")}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-signal/10 text-signal border border-signal/30 rounded-full px-3 py-1.5">
                      <i className="fas fa-check text-[8px]" />
                      {lang === "zh" ? "已認證" : "Verified"}
                    </span>
                  </div>
                ))}
            </div>

            {/* 重新提交按鈕（帶警告） */}
            <button
              onClick={() => setShowResubmitWarning(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-500 font-mono text-xs tracking-widest rounded-xl hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all"
            >
              <i className="fas fa-redo text-[10px]" />
              {lang === "zh" ? "重新提交認證" : "Resubmit Verification"}
            </button>

            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)] active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {lang === "zh" ? "返回個人頁" : "Back to Profile"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── 狀態 A：正常申請表單 ──────────────────────────────────────────────────
  return (
    <>
      {/* ── 自訂頂部 Header ── */}
      <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
        <div className="flex justify-between items-center">
          {step < 3 ? (
            <button
              onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : router.back())}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <button
            onClick={() => setActiveModal("lang")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur border border-[#444] text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg"
          >
            <i className="fas fa-globe text-sm" />
          </button>
        </div>
      </div>

    <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
      <div className="w-full max-w-lg">

        {/* Header */}
        {step < 3 && (
          <div className="mb-6">
            <h1 className="font-heavy text-2xl text-white tracking-wider">
              {t("verify_identity").toUpperCase()}
            </h1>
            <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
              HKAIIFF · CREATOR CREDENTIALING
            </div>
          </div>
        )}

        {/* Step Indicator */}
        {step < 3 && <StepIndicator current={step} total={3} labels={stepLabels} />}

        {/* ═══ STEP 1: Identity + Profile Info ══════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-300">

            {/* Identity Type */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-3">
                IDENTITY TYPE *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {IDENTITY_TYPES.map(({ value, icon }) => {
                  const isSelected = form.verificationType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateForm("verificationType", value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all relative
                        ${isSelected
                          ? "border-signal bg-signal/10 text-signal shadow-[0_0_12px_rgba(204,255,0,0.15)] active:scale-95"
                          : "border-[#2a2a2a] bg-[#0d0d0d] text-gray-500 hover:border-[#444] active:scale-95"
                        }`}
                    >
                      <i className={`fas ${icon} text-xl`} />
                      <span className="text-[10px] font-heavy tracking-wider">
                        {t(`verify_type_${value}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Verification Name（= Display Name，全平台唯一） */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-id-badge mr-1 text-signal" />
                {lang === "zh" ? "認證名稱 (VERIFICATION NAME)" : "VERIFICATION NAME"}
                <span className="text-red-500 ml-1">*</span>
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "即 Display Name，全平台唯一" : "= Display Name, globally unique"}
                </span>
              </label>
              <input
                type="text"
                value={form.verificationName}
                onChange={(e) => updateForm("verificationName", e.target.value)}
                maxLength={60}
                placeholder={lang === "zh" ? "輸入您希望顯示的認證名稱..." : "Enter the name to display on your badge..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                {form.verificationName.length}/60
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-align-left mr-1 text-purple-400" />
                BIO
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "選填，最多 200 字" : "optional, max 200 chars"}
                </span>
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => updateForm("bio", e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={lang === "zh" ? "簡短介紹自己..." : "Brief introduction..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all resize-none"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                {form.bio.length}/200
              </div>
            </div>

            {/* About Studio */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-building mr-1 text-blue-400" />
                ABOUT STUDIO
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "工作室簡介，選填" : "optional"}
                </span>
              </label>
              <textarea
                value={form.aboutStudio}
                onChange={(e) => updateForm("aboutStudio", e.target.value)}
                maxLength={400}
                rows={3}
                placeholder={lang === "zh" ? "工作室或機構簡介..." : "Studio or organization description..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all resize-none"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                {form.aboutStudio.length}/400
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-code mr-1 text-green-400" />
                TECH STACK
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "以逗號分隔，選填" : "comma-separated, optional"}
                </span>
              </label>
              <input
                type="text"
                value={form.techStack}
                onChange={(e) => updateForm("techStack", e.target.value)}
                maxLength={200}
                placeholder={lang === "zh" ? "例：AI, Unity, Blender, TouchDesigner..." : "e.g. AI, Unity, Blender, TouchDesigner..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={handleStep1Next}
              disabled={isSavingProfile}
              className="w-full py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl
                         shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:shadow-[0_0_30px_rgba(204,255,0,0.4)]
                         active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {isSavingProfile ? (
                <>
                  <i className="fas fa-circle-notch fa-spin text-sm" />
                  {lang === "zh" ? "保存中..." : "SAVING..."}
                </>
              ) : (
                t("verify_step1_submit")
              )}
            </button>
          </div>
        )}

        {/* ═══ STEP 2: Document Upload + Payment ════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-300">

            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-blue-400 rounded-full" />
                <span className="text-[10px] font-mono text-blue-400 tracking-widest">
                  {t("verify_doc_upload").toUpperCase()}
                </span>
                <span className="text-[9px] font-mono text-gray-600">{t("verify_doc_optional")}</span>
              </div>

              <p className="text-[10px] font-mono text-gray-500 leading-relaxed mb-4">
                {lang === "zh"
                  ? "支持格式：JPG、PNG、PDF。大小限制 5MB。可上傳機構認證書、個人簡歷等佐證材料。"
                  : "Accepted: JPG, PNG, PDF. Max 5MB. You may upload certificates, resumes, or other supporting materials."}
              </p>

              <input
                ref={docInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocUpload(file);
                }}
              />

              {form.docUrl ? (
                <div className="flex items-center gap-3 bg-signal/10 border border-signal/30 rounded-lg px-3 py-2.5">
                  <i className="fas fa-file-check text-signal text-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-signal font-mono truncate">{form.docFileName}</div>
                    <div className="text-[9px] text-signal/60 font-mono mt-0.5">Upload successful ✓</div>
                  </div>
                  <button
                    onClick={() => { updateForm("docUrl", ""); updateForm("docFileName", ""); }}
                    className="text-gray-500 hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => docInputRef.current?.click()}
                  disabled={isDocUploading}
                  className="w-full border-2 border-dashed border-[#333] rounded-xl py-8 flex flex-col items-center gap-3
                             text-gray-600 hover:border-signal/40 hover:text-signal/60 transition-all active:scale-[0.98]
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDocUploading ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin text-2xl" />
                      <span className="text-[10px] font-mono tracking-widest">
                        {lang === "zh" ? "上傳中..." : "UPLOADING..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-3xl" />
                      <span className="text-[10px] font-mono tracking-widest">
                        {lang === "zh" ? "點擊上傳文件" : "CLICK TO UPLOAD"}
                      </span>
                      <span className="text-[9px] font-mono text-gray-700">
                        JPG / PNG / PDF · MAX 5MB
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Application summary */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
              <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-2">APPLICATION SUMMARY</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 font-mono w-24 shrink-0">TYPE</span>
                <span className="text-white font-mono">
                  {form.verificationType ? t(`verify_type_${form.verificationType}`) : "—"}
                </span>
              </div>
              {form.verificationName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 font-mono w-24 shrink-0">CERT NAME</span>
                  <span className="text-signal font-mono font-semibold">{form.verificationName}</span>
                </div>
              )}
              {form.bio && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-gray-600 font-mono w-24 shrink-0">BIO</span>
                  <span className="text-gray-400 font-mono line-clamp-2">{form.bio}</span>
                </div>
              )}
            </div>

            {/* ── 產品資訊卡 ──────────────────────────────────────────────── */}
            <div className="w-full bg-[#080808] border border-[#1a1a1a] rounded-2xl p-5">
              <div className="font-mono text-[8px] tracking-[0.5em] text-[#333] mb-3 uppercase">
                HKAIIFF · CREATOR VERIFICATION
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-black text-base" style={{ fontFamily: "Oswald, sans-serif" }}>
                    {verifyProduct?.name_zh ?? (lang === "zh" ? "創作者身份認證" : "Creator Verification")}
                  </p>
                  <p className="text-[#444] text-[10px] font-mono mt-0.5">
                    {verifyProduct?.name_en ?? "Identity Verification"}
                  </p>
                </div>
                <div className="text-right">
                  {verifyProduct ? (
                    <>
                      <p className="text-white font-black font-mono text-lg">
                        ${Number(verifyProduct.price_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[#00E599] font-mono text-xs mt-0.5">
                        / {Number(verifyProduct.price_aif).toLocaleString()} AIF
                      </p>
                    </>
                  ) : (
                    <div className="w-20 h-6 bg-[#111] rounded animate-pulse" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5 text-[10px] font-mono text-[#333]">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40 shrink-0" />
                  {lang === "zh" ? "支持 Stripe 信用卡及 AIF 鏈上支付" : "Stripe credit card & AIF on-chain payment"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40 shrink-0" />
                  {lang === "zh" ? "支付完成後進入人工審核流程" : "Manual review begins after payment"}
                </div>
              </div>
            </div>

            {/* ── UniversalCheckout ────────────────────────────────────────── */}
            <UniversalCheckout
              productCode="identity_verify"
              extraMetadata={
                form.verificationType
                  ? {
                      identityType: form.verificationType,
                      ...(form.verificationName.trim()
                        ? { verificationName: form.verificationName.trim() }
                        : {}),
                    }
                  : undefined
              }
              variant="primary"
              label={lang === "zh" ? "SECURE PAY · 立即支付" : "SECURE PAY · VERIFY NOW"}
              className="w-full justify-center py-4 text-base rounded-2xl"
              successUrl=""
              onSuccess={async () => {
                localStorage.removeItem("pending_verification");
                setPageState("B");
                showToast(
                  lang === "zh"
                    ? "支付成功！認證申請已提交，請等待審核。"
                    : "Payment successful! Application submitted.",
                  "success"
                );
              }}
            />

            {/* ── Back button ─────────────────────────────────────────────── */}
            <button
              onClick={() => setStep(1)}
              className="w-full font-mono text-[9px] tracking-[0.4em] text-gray-400 hover:text-white transition-colors
                         flex items-center justify-center gap-1.5 py-2"
            >
              ← {t("btn_back")}
            </button>

            <p className="font-mono text-[8px] tracking-[0.3em] text-gray-500 text-center">
              SECURED BY STRIPE &amp; SOLANA · HKAIIFF 2026
            </p>
          </div>
        )}

        {/* ═══ STEP 3: Processing ════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 bg-signal rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <p className="font-mono text-xs text-gray-400 tracking-widest">
              {lang === "zh" ? "處理中..." : "PROCESSING..."}
            </p>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
```

### app/lbs/apply/page.tsx
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/app/context/I18nContext';
import { useToast } from '@/app/context/ToastContext';
import CyberLoading from '@/app/components/CyberLoading';

/* ─── UI Primitives ─────────────────────────────────────────────────────── */

function Spinner({ color }: { color: string }) {
  return (
    <div
      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: `${color} transparent transparent transparent` }}
    />
  );
}

/* ─── Form Types ─────────────────────────────────────────────────────────── */

interface LbsFormData {
  title: string;
  location: string;
  lat: string;
  lng: string;
  unlockRadius: number;
  startTime: string;
  endTime: string;
  description: string;
  contractStrategy: string;
  ticketPriceAif: number;
  ticketPriceUsd: number;
  posterUrl: string;
  backgroundUrl: string;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const CONTRACT_STRATEGIES = [
  { value: 'free', label_en: 'Free Admission (Public Access)', label_zh: '免票（公開存取）' },
  { value: 'ticket', label_en: 'Requires Ticket', label_zh: '需要門票' },
];

/* ─── Dark Input Component ───────────────────────────────────────────────── */

function DarkInput({
  label, value, onChange, type = 'text', placeholder = '', required = false, className = '', disabled = false,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; className?: string; disabled?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
        {label}
        {required && <span className="text-[#FFC107]">*</span>}
      </label>
      {type === 'datetime-local' ? (
        <div className="flex gap-2">
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => {
              const time = value ? String(value).split('T')[1] || '00:00' : '00:00';
              onChange(`${e.target.value}T${time}`);
            }}
            disabled={disabled}
            className={`flex-1 bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all font-mono [color-scheme:dark] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <input
            type="time"
            value={value ? String(value).split('T')[1]?.slice(0, 5) || '' : ''}
            onChange={(e) => {
              const date = value ? String(value).split('T')[0] : new Date().toISOString().split('T')[0];
              onChange(`${date}T${e.target.value}`);
            }}
            disabled={disabled}
            className={`w-28 bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all font-mono [color-scheme:dark] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg
                     outline-none focus:border-[#FFC107]/50 focus:shadow-[0_0_0_2px_rgba(255,193,7,0.08)]
                     transition-all placeholder-[#444] font-mono
                     ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      )}
    </div>
  );
}

/* ─── DateTime Picker Field ─────────────────────────────────────────────── */

function DateTimePickerField({ label, value, onChange, required, disabled }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; disabled?: boolean;
}) {
  const dateVal = value ? value.split('T')[0] : '';
  const hourVal = value ? value.split('T')[1]?.slice(0, 2) || '' : '';
  const minVal = value ? value.split('T')[1]?.slice(3, 5) || '' : '';

  const update = (d: string, h: string, m: string) => {
    if (d) onChange(`${d}T${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
        {label}{required && <span className="text-[#FFC107]">*</span>}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={dateVal}
          onChange={(e) => update(e.target.value, hourVal, minVal)}
          disabled={disabled}
          className={`flex-1 bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 font-mono [color-scheme:dark] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <div className={`flex items-center gap-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2.5 ${disabled ? 'opacity-50' : ''}`}>
          <input
            type="number"
            min={0}
            max={23}
            value={hourVal}
            onChange={(e) => update(dateVal, e.target.value, minVal)}
            placeholder="HH"
            disabled={disabled}
            className="w-8 bg-transparent text-white text-sm outline-none font-mono text-center"
          />
          <span className="text-[#666] font-mono">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minVal}
            onChange={(e) => update(dateVal, hourVal, e.target.value)}
            placeholder="MM"
            disabled={disabled}
            className="w-8 bg-transparent text-white text-sm outline-none font-mono text-center"
          />
        </div>
      </div>
      {value && (
        <p className="text-[10px] text-[#FFC107] font-mono">
          {new Date(value).toLocaleString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

/* ─── Upload Zone ────────────────────────────────────────────────────────── */

function UploadZone({
  label, spec, aspectLabel, previewUrl, uploadStatus, uploadError, onFileChange, accept = 'image/*', disabled = false,
}: {
  label: string; spec: string; aspectLabel: string; previewUrl: string;
  uploadStatus: UploadStatus; uploadError?: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadStatus === 'uploading';
  const isSuccess = uploadStatus === 'success';
  const isError = uploadStatus === 'error';

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-[#666] tracking-widest uppercase">{label}</div>
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={isUploading || disabled}
        className={`w-full relative rounded-xl border-2 border-dashed transition-all overflow-hidden
          ${previewUrl
            ? isError
              ? 'border-red-500/50 hover:border-red-500/70'
              : 'border-[#FFC107]/40 hover:border-[#FFC107]/70'
            : isError
              ? 'border-red-500/40'
              : isSuccess
                ? 'border-green-500/40'
                : 'border-[#333] hover:border-[#FFC107]/40 hover:shadow-[0_0_20px_rgba(255,193,7,0.04)]'
          }
          ${(isUploading || disabled) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ aspectRatio: aspectLabel === '2:3' ? '2/3' : '16/9', minHeight: aspectLabel === '2:3' ? '180px' : '100px', maxHeight: aspectLabel === '2:3' ? '220px' : '120px' }}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-mono tracking-widest">CHANGE</span>
            </div>
            {/* 成功角标 */}
            {isSuccess && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6 gap-2">
            {isUploading ? (
              <Spinner color="#FFC107" />
            ) : isSuccess ? (
              <>
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-green-400 text-[10px] font-mono tracking-wider">上传成功</span>
              </>
            ) : isError ? (
              <>
                <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-red-400 text-[10px] font-mono tracking-wider">上传失败</span>
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt text-[#FFC107]/40 text-2xl" />
                <span className="text-[#555] text-[10px] font-mono tracking-wider">{aspectLabel} · {spec}</span>
              </>
            )}
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFileChange}
        disabled={isUploading || disabled}
      />
      {/* 状态文字 */}
      {isUploading && (
        <div className="text-[10px] text-[#FFC107]/60 font-mono tracking-widest animate-pulse">正在上传...</div>
      )}
      {isSuccess && !previewUrl && (
        <div className="text-[10px] text-green-400/80 font-mono tracking-wider flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
          </svg>
          上传成功
        </div>
      )}
      {isError && uploadError && (
        <div className="text-[10px] text-red-400/80 font-mono tracking-wider flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
          {uploadError}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LbsApplyPage() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const { lang } = useI18n();
  const { showToast } = useToast();

  const [isLocating, setIsLocating] = useState(false);
  const [posterUploadStatus, setPosterUploadStatus] = useState<UploadStatus>('idle');
  const [posterUploadError, setPosterUploadError] = useState('');
  const [bgUploadStatus, setBgUploadStatus] = useState<UploadStatus>('idle');
  const [bgUploadError, setBgUploadError] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [existingNodeId, setExistingNodeId] = useState<string | null>(null);

  const [form, setForm] = useState<LbsFormData>({
    title: '',
    location: '',
    lat: '',
    lng: '',
    unlockRadius: 500,
    startTime: '',
    endTime: '',
    description: '',
    contractStrategy: 'free',
    ticketPriceAif: 0,
    ticketPriceUsd: 0,
    posterUrl: '',
    backgroundUrl: '',
  });

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  // 恢复 sessionStorage 中的草稿数据（用于从排片页面返回）
  // 同时检查：如果草稿节点已提交审核，直接跳转审核中页面，防止重复支付
  useEffect(() => {
    const saved = sessionStorage.getItem('lbs_apply_form');
    const savedNodeId = sessionStorage.getItem('lbs_draft_node_id');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LbsFormData;
        setForm(parsed);
      } catch { /* ignore */ }
    }
    if (savedNodeId) {
      setExistingNodeId(savedNodeId);
      // 异步检查节点状态，已提交的节点直接跳转审核中页面
      import('@/lib/supabase').then(({ supabase }) => {
        supabase
          .from('lbs_nodes')
          .select('id, review_status')
          .eq('id', savedNodeId)
          .maybeSingle()
          .then(({ data }) => {
            if (data && (data.review_status === 'pending' || data.review_status === 'approved')) {
              console.log('[apply] Node already submitted, redirecting. status:', data.review_status);
              router.replace(`/lbs/${savedNodeId}/review-pending`);
            }
          });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key: keyof LbsFormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // Auto-locate GPS
  const handleAutoLocate = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
        showToast(lang === 'zh' ? '座標已獲取' : 'Coordinates obtained', 'success');
      },
      () => {
        showToast('Failed to get location', 'error');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // R2 upload via unified /api/upload
  const uploadToOss = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Upload failed');
    }
    const data = await res.json();
    if (!data.success || !data.url) throw new Error('Upload did not return a valid URL');
    return data.url as string;
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPosterUploadStatus('error');
      setPosterUploadError('文件不能超过 5MB');
      return;
    }
    setPosterUploadStatus('uploading');
    setPosterUploadError('');
    try {
      const url = await uploadToOss(file);
      setForm((prev) => ({ ...prev, posterUrl: url }));
      setPosterUploadStatus('success');
    } catch (err) {
      setPosterUploadStatus('error');
      setPosterUploadError(err instanceof Error ? err.message : '上传失败，请重试');
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setBgUploadStatus('error');
      setBgUploadError('文件不能超过 10MB');
      return;
    }
    setBgUploadStatus('uploading');
    setBgUploadError('');
    try {
      const url = await uploadToOss(file);
      setForm((prev) => ({ ...prev, backgroundUrl: url }));
      setBgUploadStatus('success');
    } catch (err) {
      setBgUploadStatus('error');
      setBgUploadError(err instanceof Error ? err.message : '上传失败，请重试');
    }
  };

  // Validation
  const validateForm = (): boolean => {
    if (!form.title.trim()) { showToast(lang === 'zh' ? '請填寫影展標題' : 'Please enter festival title', 'error'); return false; }
    if (!form.location.trim()) { showToast(lang === 'zh' ? '請填寫地址' : 'Please enter location', 'error'); return false; }
    if (!form.lat || !form.lng) { showToast(lang === 'zh' ? '請提供 GPS 座標' : 'Please provide GPS coordinates', 'error'); return false; }
    if (!form.startTime || !form.endTime) { showToast(lang === 'zh' ? '請設定時間範圍' : 'Please set time range', 'error'); return false; }
    if (new Date(form.endTime) <= new Date(form.startTime)) { showToast(lang === 'zh' ? '結束時間必須晚於開始時間' : 'End time must be after start time', 'error'); return false; }
    return true;
  };

  // 创建或更新草稿节点，然后跳转到排片页面
  const handleNextStep = async () => {
    if (!validateForm()) return;
    if (!user?.id) return;

    setIsSavingDraft(true);

    // 不把 creator_id 放进 payload，由服务端从 Bearer token 中提取（更安全可靠）
    const dbPayload = {
      title: form.title.trim(),
      location: form.location.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      description: form.description.trim() || null,
      contract_req: form.contractStrategy,
      ticket_price: form.ticketPriceAif > 0 ? form.ticketPriceAif : null,
      poster_url: form.posterUrl || null,
      background_url: form.backgroundUrl || null,
      status: 'draft',
    };

    try {
      let nodeId = existingNodeId;

      const token = await getAccessToken();
      const res = await fetch('/api/lbs/save-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nodeId: nodeId ?? undefined, payload: dbPayload }),
      });

      const json = await res.json() as { id?: string; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? '保存失败，请重试');
      }

      if (!nodeId) {
        nodeId = json.id!;
        setExistingNodeId(nodeId);
        sessionStorage.setItem('lbs_draft_node_id', nodeId);
      }

      // 保存表单数据到 sessionStorage（以便返回时恢复）
      sessionStorage.setItem('lbs_apply_form', JSON.stringify(form));

      router.push(`/lbs/${nodeId}/screenings`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '保存失败，请重试', 'error');
      setIsSavingDraft(false);
    }
  };

  /* ── Guards ─────────────────────────────────────────────────────────────── */
  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;

  const isUploadingAny = posterUploadStatus === 'uploading' || bgUploadStatus === 'uploading';

  /* ─────────────────────────────────────────────────────────────────────── */
  /* STEP 1 — Application Form                                               */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#040404] px-4 pb-32" style={{ paddingTop: 'max(72px, calc(env(safe-area-inset-top) + 56px))' }}>
      {/* ── 返回按鈕（左上角固定） ───────────────────────────────────── */}
      <button
        onClick={() => router.back()}
        className="fixed z-50 w-9 h-9 rounded-full backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))', left: '16px' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>

      <div className="max-w-2xl mx-auto">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-black text-3xl text-white tracking-wider uppercase">
            {lang === 'zh' ? 'LBS 影展/影院申請' : 'LBS FESTIVAL / CINEMA'}
          </h1>
          <div className="mt-3 h-px w-16 bg-gradient-to-r from-[#FFC107]/60 to-transparent" />
        </div>

        {/* ── Step Indicator ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center">
              <span className="text-black text-[10px] font-black">1</span>
            </div>
            <span className="font-mono text-[9px] text-[#FFC107] tracking-widest">
              {lang === 'zh' ? '填寫資料' : 'APPLICATION'}
            </span>
          </div>
          <div className="flex-1 h-px bg-[#333]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center">
              <span className="text-[#555] text-[10px] font-black">2</span>
            </div>
            <span className="font-mono text-[9px] text-[#444] tracking-widest">
              {lang === 'zh' ? '排片池' : 'SCREENINGS'}
            </span>
          </div>
          <div className="flex-1 h-px bg-[#333]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center">
              <span className="text-[#555] text-[10px] font-black">3</span>
            </div>
            <span className="font-mono text-[9px] text-[#444] tracking-widest">
              {lang === 'zh' ? '支付' : 'PAYMENT'}
            </span>
          </div>
        </div>

        {/* ── Section: Location Info ──────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-4">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-map-marked-alt text-[#FFC107]/30" />
            {lang === 'zh' ? '地點資訊' : 'LOCATION INFO'}
          </div>

          <div className="space-y-4">
            <DarkInput
              label={lang === 'zh' ? '影展標題' : 'Festival Title'}
              value={form.title}
              onChange={setField('title')}
              placeholder={lang === 'zh' ? '例：香港夜光影展 2026' : 'e.g. HK Neon Film Festival 2026'}
              required
            />

            <DarkInput
              label={lang === 'zh' ? '詳細地址/地標名稱' : 'Address / Landmark'}
              value={form.location}
              onChange={setField('location')}
              placeholder={lang === 'zh' ? '例：香港中環畢打街 1 號' : 'e.g. 1 Pedder St, Central, Hong Kong'}
              required
            />

            {/* GPS Coordinates */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
                {lang === 'zh' ? 'GPS 座標' : 'GPS COORDINATES'}
                <span className="text-[#FFC107]">*</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={form.lat}
                    onChange={(e) => setField('lat')(e.target.value)}
                    placeholder="Lat (e.g. 22.279)"
                    step="0.000001"
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={form.lng}
                    onChange={(e) => setField('lng')(e.target.value)}
                    placeholder="Lng (e.g. 114.162)"
                    step="0.000001"
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoLocate}
                  disabled={isLocating}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-[#FFC107]/10 border border-[#FFC107]/30 text-[#FFC107] text-[10px] font-mono px-3 rounded-lg hover:bg-[#FFC107]/20 transition-colors disabled:opacity-50 whitespace-nowrap tracking-wider"
                >
                  {isLocating ? <Spinner color="#FFC107" /> : <i className="fas fa-crosshairs text-xs" />}
                  {lang === 'zh' ? '自動定位' : 'AUTO-LOCATE'}
                </button>
              </div>
              {form.lat && form.lng && (
                <div className="text-[10px] text-[#FFC107]/40 font-mono">
                  📍 {parseFloat(form.lat).toFixed(4)}°, {parseFloat(form.lng).toFixed(4)}°
                </div>
              )}
            </div>

            {/* Unlock Radius */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
                {lang === 'zh' ? '解鎖半徑（米）' : 'UNLOCK RADIUS (METERS)'}
                <span className="text-[#FFC107]">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={form.unlockRadius}
                  onChange={(e) => setForm((p) => ({ ...p, unlockRadius: parseInt(e.target.value) }))}
                  className="flex-1 accent-[#FFC107]"
                />
                <div className="bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2 rounded-lg font-mono min-w-[80px] text-center">
                  {form.unlockRadius}m
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Time Range ─────────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-4">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-clock text-[#FFC107]/30" />
            {lang === 'zh' ? '時間範圍' : 'TIME RANGE'}
          </div>
          <div className="space-y-4">
            <DateTimePickerField
              label={lang === 'zh' ? '開始時間' : 'Start Time'}
              value={form.startTime}
              onChange={setField('startTime')}
              required
            />
            <DateTimePickerField
              label={lang === 'zh' ? '結束時間' : 'End Time'}
              value={form.endTime}
              onChange={setField('endTime')}
              required
            />
          </div>
        </div>

        {/* ── Section: Content & Contract ────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-4">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-file-contract text-[#FFC107]/30" />
            {lang === 'zh' ? '內容與合約' : 'CONTENT & CONTRACT'}
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                {lang === 'zh' ? '影展簡介' : 'FESTIVAL DESCRIPTION'}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField('description')(e.target.value)}
                rows={4}
                placeholder={lang === 'zh' ? '詳細描述您的影展主題、特色與策展理念...' : 'Describe your festival theme, features and curatorial vision...'}
                className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono resize-none leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                {lang === 'zh' ? '智能合約策略' : 'SMART CONTRACT STRATEGY'}
              </label>
              <select
                value={form.contractStrategy}
                onChange={(e) => setField('contractStrategy')(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all font-mono"
              >
                {CONTRACT_STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {lang === 'zh' ? s.label_zh : s.label_en}
                  </option>
                ))}
              </select>
            </div>

            {form.contractStrategy === 'ticket' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                    {lang === 'zh' ? '門票費用 (AIF)' : 'TICKET PRICE (AIF)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.ticketPriceAif || ''}
                    onChange={(e) => setForm((p) => ({ ...p, ticketPriceAif: parseFloat(e.target.value) || 0 }))}
                    placeholder={lang === 'zh' ? '請輸入金額' : 'Enter amount'}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                    {lang === 'zh' ? '門票費用 (USD)' : 'TICKET PRICE (USD)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.ticketPriceUsd || ''}
                    onChange={(e) => setForm((p) => ({ ...p, ticketPriceUsd: parseFloat(e.target.value) || 0 }))}
                    placeholder={lang === 'zh' ? '請輸入金額' : 'Enter amount'}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section: Asset Upload ───────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-8">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-images text-[#FFC107]/30" />
            {lang === 'zh' ? '素材上傳' : 'ASSETS UPLOAD'}
          </div>
          <div className="grid grid-cols-2 gap-5">
            <UploadZone
              label={lang === 'zh' ? 'LBS 影展海報' : 'LBS FESTIVAL POSTER'}
              spec={lang === 'zh' ? '最大 5MB' : 'Max 5MB'}
              aspectLabel="2:3"
              previewUrl={form.posterUrl}
              uploadStatus={posterUploadStatus}
              uploadError={posterUploadError}
              onFileChange={handlePosterUpload}
              accept="image/*"
            />
            <UploadZone
              label={lang === 'zh' ? 'LBS 背景圖' : 'LBS BACKGROUND'}
              spec={lang === 'zh' ? '最大 10MB' : 'Max 10MB'}
              aspectLabel="16:9"
              previewUrl={form.backgroundUrl}
              uploadStatus={bgUploadStatus}
              uploadError={bgUploadError}
              onFileChange={handleBgUpload}
              accept="image/*"
            />
          </div>
        </div>

        {/* ── Submit Button ───────────────────────────────────────────── */}
        <button
          onClick={handleNextStep}
          disabled={isUploadingAny || isSavingDraft}
          className="w-full py-4 rounded-xl bg-[#FFC107] text-black font-heavy tracking-[0.2em] uppercase text-sm
                     shadow-[0_0_24px_rgba(255,193,7,0.3)] hover:shadow-[0_0_36px_rgba(255,193,7,0.5)]
                     active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isSavingDraft ? (
            <>
              <Spinner color="#000" />
              {lang === 'zh' ? '保存中...' : 'SAVING...'}
            </>
          ) : (
            <>
              <i className="fas fa-film text-xs" />
              {lang === 'zh' ? '下一步：選擇排片' : 'NEXT: SELECT SCREENINGS'}
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-[#333] font-mono mt-4 tracking-wider">
          {lang === 'zh' ? '提交後進入排片池，完成選片後進行支付' : 'PROCEED TO FILM SELECTION → PAYMENT'}
        </p>

      </div>
    </div>
  );
}
```

### app/discover/page.tsx
```typescript
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useModal } from '@/app/context/ModalContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { buildOssUrl } from '@/lib/utils/oss';
import FeedVideo from '@/components/FeedVideo';

// ─── Types ────────────────────────────────────────────────────────────────────

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface Curator { name: string; avatar: string; isCertified: boolean; }

interface LbsFilmEntry {
  id: string; title: string; coverUrl: string; studio: string;
  duration: string; trailerUrl: string | null; filmUrl: string | null; synopsis: string | null;
}

interface LbsNode {
  id: string | number; state: LbsState; stateLabel: string; title: string;
  location: string; coords: string; date: string; img: string; desc: string;
  req: string; dateRange: string; icon: string; borderColor: string; textColor: string;
  duration: string; city: string; country: string; venue: string;
  distance: string; distanceKm: number; lat: number; lng: number;
  unlock_radius: number; curator: Curator; filmIds: string[] | null;
  background_url: string | null; poster_url: string | null;
}

interface DbLbsNode {
  id: number | string; title: string | null; location: string | null;
  lat: number | null; lng: number | null; radius: number | null;
  unlock_radius: number | null; date_label: string | null; image_url: string | null;
  state: string | null; description: string | null; smart_contract_req: string | null;
  city: string | null; country: string | null; venue: string | null;
  film_ids: string[] | null; curator_name: string | null; curator_avatar: string | null;
  curator_certified: boolean | null; background_url: string | null; poster_url: string | null;
  start_time: string | null; end_time: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATE_CONFIG: Record<LbsState, { label: string; icon: string; border: string; text: string }> = {
  unlocked:    { label: 'UNLOCKED',    icon: 'fa-unlock',         border: 'border-signal', text: 'text-signal' },
  locked_geo:  { label: 'GEO-LOCKED',  icon: 'fa-map-marker-alt', border: 'border-danger', text: 'text-danger' },
  locked_cond: { label: 'TIME-LOCKED', icon: 'fa-clock',          border: 'border-honey',  text: 'text-honey'  },
};

function resolveState(raw: string | null): LbsState {
  if (raw === 'unlocked' || raw === 'locked_geo' || raw === 'locked_cond') return raw;
  return 'locked_geo';
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function mapDbNode(db: DbLbsNode): LbsNode {
  const state = resolveState(db.state); const cfg = STATE_CONFIG[state];
  const lat = db.lat ?? 0, lng = db.lng ?? 0;
  const coordStr = db.lat != null && db.lng != null
    ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`
    : 'ON-CHAIN';
  const dateRange = formatDateRange(db.start_time, db.end_time);
  return {
    id: db.id, state, stateLabel: cfg.label,
    title: db.title ?? 'UNNAMED NODE', location: db.location ?? 'Location TBD',
    coords: coordStr, date: db.date_label ?? (dateRange || 'TBD'),
    img: buildOssUrl(db.image_url) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
    desc: db.description ?? '', req: db.smart_contract_req ?? '',
    dateRange,
    icon: cfg.icon, borderColor: cfg.border, textColor: cfg.text,
    duration: '—', city: db.city ?? '', country: db.country ?? '', venue: db.venue ?? '',
    distance: '—', distanceKm: 0,
    lat: Number(db.lat ?? 0), lng: Number(db.lng ?? 0),
    unlock_radius: Number(db.unlock_radius ?? db.radius ?? 500),
    curator: {
      name: db.curator_name ?? 'AIF.SHOW',
      avatar: db.curator_avatar ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(String(db.id))}`,
      isCertified: db.curator_certified ?? true,
    },
    filmIds: db.film_ids ?? null,
    background_url: buildOssUrl(db.background_url) || null,
    poster_url: buildOssUrl(db.poster_url) || null,
  };
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────

function NodeSkeleton() {
  return (
    <div className="border border-[#222] rounded-xl overflow-hidden bg-[#111] min-h-[180px] animate-pulse">
      <div className="w-full h-full bg-[#1a1a1a]" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-20 h-20 rounded-full bg-[#111] border border-[#222] flex items-center justify-center">
        <i className="fas fa-map-marked-alt text-3xl text-[#333]" />
      </div>
      <div className="text-center">
        <div className="font-heavy text-lg text-[#333] tracking-widest mb-2">目前尚無上線的影展</div>
        <div className="font-mono text-[10px] text-[#2a2a2a] tracking-wider leading-relaxed max-w-xs mx-auto">
          尚無已上線的 LBS 放映節點，請靜候影展正式開放。
        </div>
      </div>
      <div className="flex items-center gap-2 bg-[#111] px-3 py-2 rounded-full border border-[#222]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#333] animate-pulse" />
        <span className="font-mono text-[9px] text-[#444] tracking-widest">AWAITING NODE BROADCAST</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE VIEW — 100% 原版卡片列表 + 全屏滑出详情抽屉，零地图
// ─────────────────────────────────────────────────────────────────────────────

interface MobileProps {
  filteredNodes: LbsNode[]; loading: boolean; userLocation: { lat: number; lng: number } | null;
  cityFilter: string; setCityFilter: (v: string) => void;
  sortOrder: 'nearest' | 'latest'; setSortOrder: (v: 'nearest' | 'latest') => void;
  allCities: string[]; selectedNode: LbsNode | null; detailFilms: LbsFilmEntry[];
  filmsLoading: boolean; onOpenDetail: (node: LbsNode) => void;
  onCloseDetail: () => void; onPlayFilm: (film: LbsFilmEntry) => void;
}

function MobileDiscover({
  filteredNodes, loading, userLocation, cityFilter, setCityFilter,
  sortOrder, setSortOrder, allCities, selectedNode, detailFilms,
  filmsLoading, onOpenDetail, onCloseDetail, onPlayFilm,
}: MobileProps) {
  const [selectedFilmForDetail, setSelectedFilmForDetail] = useState<LbsFilmEntry | null>(null);

  return (
    /* Logo 已移除（仅 /me 显示），顶部间距 pt-16；BottomNav=50px，pb-16 足够 */
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-16 pb-16 relative">

      {/* Header */}
      <div className="flex justify-between items-end mb-2">
        <h1 className="font-heavy text-4xl text-white">DISCOVER</h1>
        <div className="flex items-center gap-2 mb-2 bg-[#111] px-2 py-1 rounded border border-[#333]">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-honey animate-pulse' : 'bg-signal animate-pulse'}`} />
          <span className="font-mono text-[8px] text-signal tracking-widest uppercase">
            {loading ? 'LOADING NODES...' : `${filteredNodes.length} NODES ACTIVE`}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="font-mono text-[10px] text-gray-400 mb-5 leading-relaxed border-l-2 border-[#333] pl-2">
        由地理位置解鎖的 LBS 獨家放映活動，走近影展現場範圍即可解鎖觀看。
      </p>

      {/* Filter Toolbar */}
      {!loading && filteredNodes.length > 0 && (
        <div className="flex gap-3 mb-6">
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="bg-black border border-[#333] text-[#CCFF00] text-xs font-mono p-2 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-[#CCFF00]">
            <option value="all">All Cities</option>
            {allCities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'nearest' | 'latest')}
            className="bg-black border border-[#333] text-[#CCFF00] text-xs font-mono p-2 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-[#CCFF00]">
            <option value="nearest">Nearest</option>
            <option value="latest">Latest</option>
          </select>
        </div>
      )}

      {/* Node Card List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <NodeSkeleton key={i} />)}
        </div>
      ) : filteredNodes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {filteredNodes.map((node) => {
            const dist = userLocation && (node.lat !== 0 || node.lng !== 0)
              ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
              : Infinity;
            const isUnlocked = node.state === 'unlocked' ||
              (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));
            const bgSrc = node.background_url ?? node.img;
            return (
              <div
                key={node.id}
                className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer group shadow-lg ${
                  isUnlocked ? 'border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.15)]' : 'border-red-900/50 opacity-80'
                }`}
                onClick={() => onOpenDetail(node)}
              >
                {/* Background image */}
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-700"
                  style={{ backgroundImage: bgSrc ? `url('${bgSrc}')` : 'none' }}
                />
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />

                <div className="relative z-10 p-5 flex flex-col justify-between h-full min-h-[180px]">
                  {/* Top row */}
                  <div className="flex justify-between items-start">
                    {node.state === 'locked_cond' ? (
                      <div className="bg-black/80 border border-honey text-[9px] font-mono px-2 py-1 rounded text-honey flex items-center gap-1.5 backdrop-blur">
                        <i className="fas fa-clock" /><span>TIME-LOCKED</span>
                      </div>
                    ) : isUnlocked ? (
                      <div className="border border-[#CCFF00] text-[#CCFF00] px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 bg-black/80 backdrop-blur">
                        <i className="fas fa-unlock" /> UNLOCKED
                      </div>
                    ) : (
                      <div className="border border-red-500 text-red-500 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 bg-black/80 backdrop-blur">
                        <i className="fas fa-map-marker-alt" /> GEO-LOCKED
                      </div>
                    )}
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] font-mono text-gray-300 bg-black/50 px-2 py-1 rounded backdrop-blur border border-[#333] max-w-[160px] text-right">
                        📍 {[node.country, node.city, node.venue].filter(Boolean).join(' ') || node.location}
                      </div>
                      <div className="text-[9px] font-mono text-gray-500 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-[#333]">
                        🎬 放映影片：{node.filmIds?.length || 0} 部
                      </div>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div>
                    <h3 className="font-heavy text-white text-2xl mb-1 tracking-wide drop-shadow-md">{node.title}</h3>
                    {node.desc && <p className="line-clamp-2 text-xs text-gray-400 mt-1 mb-2">{node.desc}</p>}
                    {node.dateRange && (
                      <div className={`text-[10px] font-mono border-l-2 ${node.borderColor} pl-2 leading-snug bg-black/40 py-1 pr-1 backdrop-blur rounded-r mb-3 ${node.textColor}`}>
                        {node.dateRange}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <img src={node.curator.avatar} alt="AIF.SHOW" className="w-5 h-5 rounded-full border border-[#444] object-cover shrink-0" />
                      <span className="text-[10px] font-mono text-gray-300 font-bold">AIF.SHOW</span>
                      <i className="fas fa-check-circle text-blue-400 text-[10px]" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Full-screen Detail Drawer (slides up) ──
          z-[400] within mobile context (below BottomNav z-[999]) but covers page content */}
      <div
        className={`fixed inset-0 z-[400] bg-[#050505] flex flex-col transition-transform duration-300 ${
          selectedNode ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Top nav bar — 懸浮在 Hero 圖上方 */}
        <div className="absolute top-0 left-0 w-full z-30 flex justify-between items-center p-4 pt-12 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <button
            onClick={() => {
              if (selectedFilmForDetail) { setSelectedFilmForDetail(null); }
              else { onCloseDetail(); }
            }}
            className="w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform pointer-events-auto"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div className="font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333]">
            {selectedFilmForDetail ? 'FILM DETAILS' : 'EVENT DETAILS'}
          </div>
          <div className="w-10" />
        </div>

        {selectedNode && (
          <div className="overflow-y-auto flex-1 pb-32">

            {/* ── Hero Section：全幅背景圖 + 漸變遮罩，標題/場地/時間嵌入底部 ── */}
            <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden shrink-0">
              <img
                src={selectedNode.background_url ?? selectedNode.img}
                alt={selectedNode.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { const t = e.currentTarget; if (t.src !== selectedNode.img) t.src = selectedNode.img; }}
              />
              {/* 關鍵渐变遮罩：確保底部文字絕對清晰 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
              {/* 底部文字 overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 z-10">
                <div className={`inline-block text-[9px] font-mono px-2 py-1 rounded mb-2 border backdrop-blur ${selectedNode.borderColor} ${selectedNode.textColor} bg-black/80`}>
                  <i className={`fas ${selectedNode.icon} mr-1`} />{selectedNode.stateLabel}
                </div>
                <h2 className="font-heavy text-4xl text-white leading-none drop-shadow-md mb-2">{selectedNode.title}</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-300 mb-1">
                  <i className="fas fa-map-marker-alt text-[#CCFF00] text-[10px]" />
                  <span>{[selectedNode.country, selectedNode.city, selectedNode.venue].filter(Boolean).join(' · ') || selectedNode.location}</span>
                </div>
                {selectedNode.dateRange && (
                  <div className="text-xs font-mono text-signal">{selectedNode.dateRange}</div>
                )}
              </div>
            </div>

            {/* ── Content Body ── */}
            <div className="px-6 mt-6 relative z-10 space-y-6">

              {/* Curator */}
              <div className="flex items-center gap-2 text-sm font-mono text-gray-400">
                <img src={selectedNode.curator.avatar} alt={selectedNode.curator.name} className="w-6 h-6 rounded-full border border-[#444] object-cover" />
                <span>策展人：</span>
                <span className="text-white font-bold">{selectedNode.curator.name}</span>
                {selectedNode.curator.isCertified && <i className="fas fa-certificate text-[#CCFF00] text-xs" />}
              </div>

              {/* Event Description */}
              {selectedNode.desc && (
                <section>
                  <h3 className="font-heavy text-lg text-white mb-2">EVENT DESCRIPTION</h3>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">{selectedNode.desc}</p>
                </section>
              )}

              {/* ── Official Selection：單列圖文卡片（移動端），PC 端兩列 ── */}
              <section>
                <h3 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                  <i className="fas fa-film text-[#CCFF00]" /> OFFICIAL SELECTION
                </h3>
                {filmsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex gap-4">
                        <div className="w-24 shrink-0 aspect-[2/3] rounded-xl bg-[#1a1a1a]" />
                        <div className="flex-1 space-y-2 py-2">
                          <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
                          <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
                          <div className="h-3 bg-[#1a1a1a] rounded w-full" />
                          <div className="h-3 bg-[#1a1a1a] rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : detailFilms.length === 0 ? (
                  <div className="bg-[#111] border border-[#222] rounded-xl p-6 flex flex-col items-center gap-3">
                    <i className="fas fa-film text-2xl text-[#333]" />
                    <span className="font-mono text-[10px] text-[#444] tracking-widest">NO FILMS ASSIGNED TO THIS NODE</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailFilms.map((film) => (
                      <div
                        key={film.id}
                        className="group bg-[#111] rounded-xl border border-white/10 overflow-hidden shadow-xl cursor-pointer flex active:scale-[0.98] transition-transform duration-150"
                        onClick={() => setSelectedFilmForDetail(film)}
                      >
                        {/* 海報縮圖 */}
                        <div className="relative w-24 shrink-0 overflow-hidden" style={{ aspectRatio: '2/3' }}>
                          <img
                            src={film.coverUrl} alt={film.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300'; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111]/30" />
                          {film.filmUrl && (
                            <div className="absolute bottom-1.5 left-1.5 bg-[#CCFF00] text-black text-[7px] font-bold px-1.5 py-0.5 rounded-sm leading-none">正片</div>
                          )}
                        </div>
                        {/* 文字資訊 */}
                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                          <div>
                            <h4 className="text-base font-black text-white leading-tight mb-1 line-clamp-2">{film.title}</h4>
                            <p className="text-xs text-emerald-400 truncate mb-2">{film.studio}</p>
                            {film.synopsis && (
                              <p className="text-[11px] text-gray-400 line-clamp-3 leading-snug">{film.synopsis}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                              <i className="fas fa-play text-[8px]" /> 查看詳情
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 放映時間 */}
              {selectedNode.dateRange && (
                <section className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#333] p-4 rounded-xl relative overflow-hidden">
                  <div className={`absolute left-0 top-0 w-1 h-full ${selectedNode.borderColor.replace('border-', 'bg-')}`} />
                  <h3 className="font-heavy text-lg text-white mb-2">放映時間</h3>
                  <p className={`text-sm font-mono font-bold ${selectedNode.textColor}`}>{selectedNode.dateRange}</p>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ── 影片詳情子視圖：覆蓋在 LBS 詳情頁之上 ── */}
        <div
          className={`absolute inset-0 z-20 bg-[#050505] flex flex-col transition-transform duration-300 ${
            selectedFilmForDetail ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedFilmForDetail && (
            <div className="flex-1 overflow-y-auto pb-32">
              {/* 預告片視頻區域 */}
              {selectedFilmForDetail.trailerUrl ? (
                <div className="w-full aspect-video bg-black relative pt-14">
                  <FeedVideo
                    src={buildOssUrl(selectedFilmForDetail.trailerUrl) || undefined}
                    poster={selectedFilmForDetail.coverUrl}
                    className="w-full h-full object-contain"
                    muted={false}
                    visibilityThreshold={0.3}
                  />
                </div>
              ) : (
                <div className="relative w-full aspect-video overflow-hidden bg-[#0a0a0a] pt-14">
                  <img
                    src={selectedFilmForDetail.coverUrl}
                    alt={selectedFilmForDetail.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/40 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-film text-4xl text-[#333]" />
                  </div>
                </div>
              )}

              {/* 影片資訊 */}
              <div className="px-6 py-5 space-y-4">
                {selectedFilmForDetail.filmUrl && (
                  <span className="inline-block bg-[#CCFF00] text-black text-[9px] font-bold px-2.5 py-1 rounded-sm tracking-wider">正片可用</span>
                )}
                <h2 className="font-heavy text-3xl text-white leading-tight">{selectedFilmForDetail.title}</h2>
                <p className="text-emerald-400 text-sm font-mono">{selectedFilmForDetail.studio}</p>

                {selectedFilmForDetail.synopsis && (
                  <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-[#333] pl-3">{selectedFilmForDetail.synopsis}</p>
                )}

                {/* ▶ 播放正片 按鈕 */}
                {selectedFilmForDetail.filmUrl && (
                  <button
                    onClick={() => onPlayFilm(selectedFilmForDetail)}
                    className="w-full bg-[#CCFF00] text-black font-heavy text-lg py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white transition-colors active:scale-95 shadow-[0_0_24px_rgba(204,255,0,0.25)]"
                  >
                    <i className="fas fa-play" />
                    ▶ 播放正片
                  </button>
                )}

                {/* 播放預告片 按鈕（無正片時顯示） */}
                {!selectedFilmForDetail.filmUrl && selectedFilmForDetail.trailerUrl && (
                  <button
                    onClick={() => onPlayFilm(selectedFilmForDetail)}
                    className="w-full bg-[#111] border border-white/20 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
                  >
                    <i className="fas fa-play text-[#CCFF00]" />
                    播放預告片
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP VIEW — 卡片矩阵 + 搜索框，零地图
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopCardProps { node: LbsNode; isUnlocked: boolean; dist: number; onClick: () => void; }
function DesktopNodeCard({ node, isUnlocked, dist, onClick }: DesktopCardProps) {
  const posterSrc = node.poster_url ?? node.img;
  return (
    <div onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-300
        ${isUnlocked
          ? 'border-signal/40 hover:border-signal shadow-[0_0_12px_rgba(204,255,0,0.05)] hover:shadow-[0_0_20px_rgba(204,255,0,0.15)]'
          : node.state === 'locked_cond'
          ? 'border-honey/30 hover:border-honey/60 opacity-85 hover:opacity-100'
          : 'border-red-900/30 hover:border-red-900/60 opacity-75 hover:opacity-100'
        }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#0d0d0d]">
        <img src={posterSrc} alt={node.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400'; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {/* State badge */}
        <div className="absolute top-2.5 left-2.5">
          {isUnlocked ? (
            <span className="border border-signal text-signal px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/70 backdrop-blur">
              <i className="fas fa-unlock text-[7px]" /> UNLOCKED
            </span>
          ) : node.state === 'locked_cond' ? (
            <span className="border border-honey text-honey px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/70 backdrop-blur">
              <i className="fas fa-clock text-[7px]" /> TIME-LOCKED
            </span>
          ) : (
            <span className="border border-red-500 text-red-400 px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/70 backdrop-blur">
              <i className="fas fa-map-marker-alt text-[7px]" /> GEO-LOCKED
            </span>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5 text-[8px] font-mono text-gray-400 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded border border-[#333]">
          🎬 {node.filmIds?.length ?? 0}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-heavy text-white text-base leading-tight mb-1 line-clamp-2">{node.title}</h3>
          <p className="text-[9px] font-mono text-gray-400 flex items-center gap-1 mb-2">
            <i className={`fas fa-map-marker-alt ${node.textColor} text-[8px]`} />
            <span className="truncate">{[node.country, node.city, node.venue].filter(Boolean).join(' · ') || node.location}</span>
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono text-[#555]">{node.date}</span>
            {dist !== Infinity && (
              <span className={`text-[8px] font-mono ${isUnlocked ? 'text-signal' : 'text-[#555]'}`}>
                {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className={`px-4 py-2 rounded-full text-xs font-bold font-mono tracking-wider shadow-lg ${isUnlocked ? 'bg-signal text-black' : 'bg-black/80 text-[#555] border border-[#333]'}`}>
          {isUnlocked ? '▶ ENTER' : '🔒 LOCKED'}
        </div>
      </div>
    </div>
  );
}

function DesktopSkeleton() {
  return <div className="rounded-xl border border-[#1a1a1a] overflow-hidden bg-[#0d0d0d] animate-pulse"><div className="aspect-[3/4] bg-[#141414]" /></div>;
}

interface DesktopProps {
  filteredNodes: LbsNode[]; loading: boolean; userLocation: { lat: number; lng: number } | null;
  cityFilter: string; setCityFilter: (v: string) => void;
  sortOrder: 'nearest' | 'latest'; setSortOrder: (v: 'nearest' | 'latest') => void;
  allCities: string[]; searchQuery: string; setSearchQuery: (v: string) => void;
  onClickNode: (node: LbsNode) => void;
}

function DesktopDiscover({
  filteredNodes, loading, userLocation, cityFilter, setCityFilter,
  sortOrder, setSortOrder, allCities, searchQuery, setSearchQuery, onClickNode,
}: DesktopProps) {
  const getStatus = (node: LbsNode) => {
    const dist = userLocation && (node.lat !== 0 || node.lng !== 0)
      ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
      : Infinity;
    const isUnlocked = node.state === 'unlocked' ||
      (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));
    return { dist, isUnlocked };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-void">
      {/* Header + Search */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-[#1a1a1a] flex items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-heavy text-2xl text-white tracking-wider">DISCOVER</h1>
            <div className="flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#1a1a1a]">
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-honey animate-pulse' : 'bg-signal animate-pulse'}`} />
              <span className="font-mono text-[8px] text-signal tracking-widest">
                {loading ? 'LOADING...' : `${filteredNodes.length} NODES ACTIVE`}
              </span>
            </div>
          </div>
          <p className="font-mono text-[9px] text-[#444] leading-relaxed">
            LBS 地理位置解鎖的獨家放映活動 · 走近影展現場即可解鎖地理圍欄場館
          </p>
        </div>
        <div className="relative w-72 shrink-0">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a3a] text-[11px]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search venues, cities..."
            className="w-full bg-[#0e0e0e] border border-[#1e1e1e] text-white text-xs font-mono pl-9 pr-8 py-2 rounded-lg placeholder-[#383838] focus:outline-none focus:border-signal/30 transition-all" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-white">
              <i className="fas fa-times text-[10px]" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      {!loading && filteredNodes.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5 border-b border-[#0e0e0e] bg-[#030303]">
          <span className="text-[9px] font-mono text-[#444] tracking-widest uppercase shrink-0">Filter:</span>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="bg-black border border-[#222] text-signal text-[10px] font-mono px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none focus:border-signal/40">
            <option value="all">All Cities</option>
            {allCities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'nearest' | 'latest')}
            className="bg-black border border-[#222] text-signal text-[10px] font-mono px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none focus:border-signal/40">
            <option value="nearest">Nearest First</option>
            <option value="latest">Latest First</option>
          </select>
          {searchQuery && (
            <span className="text-[9px] font-mono text-[#555] ml-auto">
              {filteredNodes.length} result{filteredNodes.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </div>
      )}

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-4 p-6">
            {[...Array(8)].map((_, i) => <DesktopSkeleton key={i} />)}
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="col-span-full w-full">
            <EmptyState />
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-4 p-6">
            {filteredNodes.map((node) => {
              const { dist, isUnlocked } = getStatus(node);
              return (
                <DesktopNodeCard key={node.id} node={node} isUnlocked={isUnlocked} dist={dist} onClick={() => onClickNode(node)} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ENTRY — Shared data layer, physical component isolation
// ─────────────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<LbsNode | null>(null);
  const [detailFilms, setDetailFilms] = useState<LbsFilmEntry[]>([]);
  const [filmsLoading, setFilmsLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'latest'>('nearest');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { setActiveModal, setLbsVideoUrl } = useModal();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      ),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    async function fetchNodes() {
      try {
        const { data, error } = await supabase
          .from('lbs_nodes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Discover Fetch Error:", error);
          setNodes([]);
          return;
        }

        console.log(`[Discover] 查詢成功，共 ${data?.length ?? 0} 個上線節點`, data);
        setNodes(data && data.length > 0 ? (data as DbLbsNode[]).map(mapDbNode) : []);
      } catch (err) {
        console.error("Discover Fetch Error:", err);
        setNodes([]);
      } finally { setLoading(false); }
    }
    fetchNodes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCities = useMemo(() => [...new Set(nodes.map((n) => n.city))], [nodes]);

  const filteredNodes = useMemo(() => {
    let base = cityFilter === 'all' ? [...nodes] : nodes.filter((n) => n.city === cityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter((n) =>
        n.title.toLowerCase().includes(q) || n.city.toLowerCase().includes(q) ||
        n.country.toLowerCase().includes(q) || n.venue.toLowerCase().includes(q)
      );
    }
    return sortOrder === 'nearest' ? [...base].sort((a, b) => a.distanceKm - b.distanceKm) : base;
  }, [nodes, cityFilter, sortOrder, searchQuery]);

  // Mobile: geo-check then show detail drawer
  const openDetail = useCallback(async (node: LbsNode) => {
    if (node.state === 'locked_cond') { showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error'); return; }
    if (node.lat !== 0 || node.lng !== 0) {
      if (!navigator.geolocation) { showToast('🔒 您的設備不支持地理定位，無法解鎖 LBS 影展', 'error'); return; }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
        );
        const dist = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, node.lat, node.lng));
        const radius = Number(node.unlock_radius) || 500;
        if (dist > radius) {
          showToast(
            process.env.NODE_ENV === 'development'
              ? `🔒 DEV: ${dist}m > ${radius}m`
              : `🔒 未在解鎖範圍內。您距離影展還有 ${dist} 米，需要進入 ${radius} 米範圍內`,
            'error'
          );
          return;
        }
      } catch {
        if (node.state !== 'unlocked') { showToast('🔒 無法獲取您的位置，請允許位置權限後重試', 'error'); return; }
      }
    } else if (node.state !== 'unlocked') { showToast('🔒 Location or time window requirement not met', 'error'); return; }

    setSelectedNode(node);
    setDetailFilms([]);

    if (node.filmIds && node.filmIds.length > 0) {
      setFilmsLoading(true);
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, poster_url, studio, trailer_url, feature_url, synopsis')
          .in('id', node.filmIds)
          .eq('status', 'approved');
        if (error) throw error;
        if (data && data.length > 0) {
          setDetailFilms(data.map((f) => ({
            id: f.id, title: f.title,
            coverUrl: buildOssUrl(f.poster_url) || 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300',
            studio: f.studio ?? '—', duration: '—',
            trailerUrl: f.trailer_url ?? null, filmUrl: f.feature_url ?? null, synopsis: f.synopsis ?? null,
          })));
        }
      } catch (err) { console.error('[Discover] Failed to load node films:', err); }
      finally { setFilmsLoading(false); }
    }
  }, [showToast]);

  const closeDetail = useCallback(() => { setSelectedNode(null); setDetailFilms([]); }, []);

  const playFilm = useCallback((film: LbsFilmEntry) => {
    const playUrl = film.filmUrl ?? film.trailerUrl ?? null;
    if (!playUrl) { showToast('⚠️ 此影片暫無可播放的正片連結', 'error'); return; }
    setLbsVideoUrl(playUrl);
    // 不關閉 selectedNode，保留抽屜狀態，關閉播放器後可直接回到詳情頁
    setActiveModal('play');
  }, [setLbsVideoUrl, setActiveModal, showToast]);

  // Desktop: navigate to events page
  const openNodeDesktop = useCallback(async (node: LbsNode) => {
    if (node.state === 'locked_cond') { showToast('🔒 此影展尚未開放', 'error'); return; }
    if (node.lat !== 0 || node.lng !== 0) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
        );
        const dist = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, node.lat, node.lng));
        const radius = Number(node.unlock_radius) || 500;
        if (dist > radius) {
          showToast(
            process.env.NODE_ENV === 'development'
              ? `🔒 DEV: ${dist}m > ${radius}m`
              : `🔒 您距離影展還有 ${dist} 米，需要進入 ${radius} 米範圍內`,
            'error'
          );
          return;
        }
      } catch {
        if (node.state !== 'unlocked') { showToast('🔒 Location requirement not met', 'error'); return; }
      }
    } else if (node.state !== 'unlocked') { showToast('🔒 Location requirement not met', 'error'); return; }
    router.push(`/events/${node.id}`);
  }, [router, showToast]);

  const sharedProps = { filteredNodes, loading, userLocation, cityFilter, setCityFilter, sortOrder, setSortOrder, allCities };

  return (
    <>
      {/* ══ MOBILE: 原版卡片列表 + 全屏抽屉，零地图 ══ */}
      <div className="block md:hidden h-full">
        <MobileDiscover
          {...sharedProps}
          selectedNode={selectedNode}
          detailFilms={detailFilms}
          filmsLoading={filmsLoading}
          onOpenDetail={openDetail}
          onCloseDetail={closeDetail}
          onPlayFilm={playFilm}
        />
      </div>

      {/* ══ DESKTOP: 卡片矩阵 + 搜索，零地图 ══ */}
      <div className="hidden md:block h-full">
        <DesktopDiscover
          {...sharedProps}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClickNode={openNodeDesktop}
        />
      </div>
    </>
  );
}
```

### app/awards/page.tsx
```typescript
"use client";

import BackButton from "@/components/BackButton";
import { useI18n } from "@/app/context/I18nContext";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

const PRIZE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function AwardsPage() {
  const { t } = useI18n();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* ── BACK BUTTON ─────────────────────────────────────────── */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50">
        <BackButton />
      </div>
      {/* ── HERO ────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Parallax trophy background */}
        <motion.div
          style={{ y: bgY, scale: bgScale }}
          className="absolute inset-0 z-0"
        >
          <Image
            src="/images/unicorn-trophy.jpeg"
            alt="Unicorn Trophy"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          {/* Multi-layer dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/40 to-[#050505]/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-transparent to-[#050505]/60" />
          {/* Signal yellow glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_55%_45%,rgba(204,255,0,0.12),transparent_70%)]" />
        </motion.div>

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-24 flex flex-col md:flex-row md:items-center gap-12"
        >
          {/* Left — text */}
          <div className="flex-1 flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-3"
            >
              <span className="h-px w-12 bg-[#CCFF00]" />
              <span className="text-[#CCFF00] font-mono text-xs tracking-[0.3em] uppercase">
                HKAIIFF · 2026
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter text-white leading-none"
              style={{ textShadow: "0 0 80px rgba(204,255,0,0.25), 0 0 160px rgba(204,255,0,0.1)" }}
            >
              {t("awards.pageTitle")}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="text-[#CCFF00] text-xl md:text-2xl font-mono tracking-widest uppercase"
            >
              {t("awards.pageSub")}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="text-white/60 text-base md:text-lg leading-relaxed max-w-xl"
            >
              {t("awards.pageDesc")}
            </motion.p>
          </div>

          {/* Right — mobile trophy image (visible only on small screens) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="flex-shrink-0 md:hidden relative w-full h-[50vw] rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 0 60px rgba(204,255,0,0.2), 0 0 120px rgba(204,255,0,0.08)" }}
          >
            <Image
              src="/images/unicorn-trophy.jpeg"
              alt="Unicorn Trophy"
              fill
              className="object-cover object-center"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        >
          <span className="text-white/30 font-mono text-xs tracking-widest">SCROLL</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-px h-8 bg-gradient-to-b from-[#CCFF00]/60 to-transparent"
          />
        </motion.div>
      </section>

      {/* ── GOLD SUPREME ────────────────────────────────────────── */}
      <section className="relative py-20 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section label */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="flex items-center gap-4 mb-12"
          >
            <span className="h-px flex-1 max-w-[60px] bg-[#CCFF00]/40" />
            <span className="text-[#CCFF00]/70 font-mono text-xs tracking-[0.3em] uppercase">
              01 · THE SUPREME
            </span>
          </motion.div>

          {/* Gold card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="relative w-full rounded-3xl overflow-hidden border border-yellow-500/30 p-8 md:p-14"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(5,5,5,0.95) 50%, rgba(204,255,0,0.04) 100%)",
              boxShadow:
                "0 0 60px rgba(255,200,0,0.12), 0 0 120px rgba(255,200,0,0.06), inset 0 1px 0 rgba(255,215,0,0.15)",
            }}
          >
            {/* Gold glow corner */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-[radial-gradient(circle,rgba(255,200,0,0.15),transparent_70%)] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-[radial-gradient(circle,rgba(204,255,0,0.08),transparent_70%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
              {/* Left */}
              <div className="flex-1">
                <p className="text-yellow-400/70 font-mono text-xs tracking-[0.3em] uppercase mb-4">
                  {t("awards.goldSectionTitle")}
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                  {t("awards.goldPrizeName")}
                </h2>
                <p className="text-white/55 text-base md:text-lg leading-relaxed max-w-2xl">
                  {t("awards.goldPrizeDesc")}
                </p>
              </div>

              {/* Right — prize amount */}
              <div className="flex-shrink-0 flex flex-col items-start lg:items-end gap-2">
                <div
                  className="px-6 py-4 rounded-2xl border border-yellow-400/40"
                  style={{
                    background: "rgba(255,200,0,0.08)",
                    boxShadow: "0 0 30px rgba(255,200,0,0.15)",
                  }}
                >
                  <p className="text-yellow-300/60 font-mono text-xs tracking-widest mb-1 uppercase">
                    PRIZE
                  </p>
                  <p
                    className="text-3xl md:text-4xl font-black text-yellow-300 leading-none"
                    style={{ textShadow: "0 0 30px rgba(255,200,0,0.5)" }}
                  >
                    {t("awards.goldPrizeAmount").split(" ")[0]}
                  </p>
                  <p className="text-yellow-400/70 font-mono text-sm mt-1">
                    {t("awards.goldPrizeAmount").split(" ").slice(1).join(" ")}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SILVER FRONTIER MATRIX ──────────────────────────────── */}
      <section className="relative py-10 md:py-20 px-6 md:px-12 pb-32">
        <div className="max-w-7xl mx-auto">
          {/* Section label */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="flex items-center gap-4 mb-4"
          >
            <span className="h-px flex-1 max-w-[60px] bg-[#CCFF00]/40" />
            <span className="text-[#CCFF00]/70 font-mono text-xs tracking-[0.3em] uppercase">
              02 · FRONTIER MATRIX
            </span>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="text-3xl md:text-5xl font-black text-white mb-14 leading-tight"
          >
            {t("awards.silverSectionTitle")}
          </motion.h2>

          {/* 4-column grid on desktop, 2-col tablet, 1-col mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {PRIZE_INDICES.map((i) => (
              <PrizeCard key={i} index={i} t={t} />
            ))}
          </div>
        </div>

        {/* Bottom ambient glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-[radial-gradient(ellipse,rgba(204,255,0,0.05),transparent_70%)] pointer-events-none" />
      </section>
    </main>
  );
}

// ── Prize Card Component ───────────────────────────────────────────────────────

function PrizeCard({
  index,
  t,
}: {
  index: number;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      custom={index % 4}
      whileHover={{ y: -6, boxShadow: "0 0 40px rgba(204,255,0,0.15), 0 20px 60px rgba(0,0,0,0.5)" }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col gap-4 rounded-2xl border border-white/8 p-6 cursor-default"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(5,5,5,0.9) 100%)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Hover glow overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(204,255,0,0.07),transparent)] pointer-events-none" />

      {/* Prize amount badge */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-2xl font-black text-[#CCFF00] leading-none"
          style={{ textShadow: "0 0 20px rgba(204,255,0,0.4)" }}
        >
          {t(`awards.prize${index}.amount`)}
        </span>
        {/* Index number */}
        <span className="text-white/15 font-mono text-xs mt-1">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Prize name */}
      <h3 className="text-white font-bold text-base leading-snug">
        {t(`awards.prize${index}.name`)}
      </h3>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-[#CCFF00]/20 via-white/5 to-transparent" />

      {/* Standard */}
      <p className="text-[#CCFF00]/60 font-mono text-xs tracking-wide uppercase leading-snug">
        {t(`awards.prize${index}.standard`)}
      </p>

      {/* Description */}
      <p className="text-white/45 text-sm leading-relaxed flex-1">
        {t(`awards.prize${index}.desc`)}
      </p>
    </motion.div>
  );
}
```

### app/messages/page.tsx
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';
import Link from 'next/link';
import DynamicLogoWall from '@/components/DynamicLogoWall';

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgType = 'system' | 'renders' | 'on-chain' | 'lbs';
type TabType = 'all' | 'renders' | 'on-chain';

interface DbMessage {
  id: string;
  msg_type: MsgType;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  user_id: string | null;
  action_link: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_HIDDEN_KEY = 'hiddenGlobalMsgs';
const LS_READ_KEY   = 'readGlobalMsgs';

function getLocalArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]; } catch { return []; }
}
function setLocalArray(key: string, arr: string[]) { localStorage.setItem(key, JSON.stringify(arr)); }

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

// ─── Icon Config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<MsgType, { icon: string; ring: string; bg: string; text: string }> = {
  renders:    { icon: 'fa-video',               ring: 'border-[#CCFF00]', bg: 'bg-[#CCFF00]/10', text: 'text-[#CCFF00]' },
  'on-chain': { icon: 'fa-link',                ring: 'border-cyan-400',  bg: 'bg-cyan-400/10',  text: 'text-cyan-400'  },
  system:     { icon: 'fa-exclamation-triangle', ring: 'border-blue-400', bg: 'bg-blue-400/10',  text: 'text-blue-400'  },
  lbs:        { icon: 'fa-map-marker-alt',       ring: 'border-green-400', bg: 'bg-green-400/10', text: 'text-green-400' },
};

const TABS: { label: string; value: TabType }[] = [
  { label: 'ALL',      value: 'all'      },
  { label: 'RENDERS',  value: 'renders'  },
  { label: 'ON-CHAIN', value: 'on-chain' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MsgSkeleton() {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 flex gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/5 bg-[#1e1e1e] rounded" />
        <div className="h-2.5 w-4/5 bg-[#171717] rounded" />
        <div className="h-2 w-1/4 bg-[#171717] rounded mt-2" />
      </div>
    </div>
  );
}

// ─── Shared Sub-Components (used by both views) ────────────────────────────────

interface MsgListItemProps {
  msg: DbMessage; isGlobalRead: boolean; isSelected: boolean;
  onSelect: (msg: DbMessage) => void;
}
function MsgListItem({ msg, isGlobalRead, isSelected, onSelect }: MsgListItemProps) {
  const resolvedType = (msg.msg_type ?? msg.type) as MsgType;
  const cfg = TYPE_CONFIG[resolvedType] ?? TYPE_CONFIG.system;
  const isGlobal = msg.user_id === null;
  const isUnread = isGlobal ? !isGlobalRead : !msg.is_read;
  return (
    <button
      onClick={() => onSelect(msg)}
      className={`w-full text-left relative p-3 flex gap-3 rounded-xl transition-all duration-150 ${
        isSelected
          ? 'bg-[#141414] border border-[#2a2a2a]'
          : 'hover:bg-[#0d0d0d] border border-transparent hover:border-[#1a1a1a]'
      }`}
    >
      {isUnread && (
        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#CCFF00] shadow-[0_0_6px_#CCFF00] animate-pulse" />
      )}
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.ring} ${cfg.bg}`}>
        <i className={`fas ${cfg.icon} text-[10px] ${cfg.text}`} />
      </div>
      <div className="flex-1 min-w-0 pr-3">
        <p className={`text-xs font-bold truncate mb-0.5 ${isUnread ? 'text-white' : 'text-[#777]'}`}>{msg.title}</p>
        <p className="text-[10px] text-[#555] font-mono line-clamp-1 leading-relaxed">{msg.content}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[8px] text-[#3a3a3a] font-mono">{formatRelativeTime(msg.created_at)}</span>
          {isGlobal && (
            <span className="text-[7px] font-mono px-1 py-0.5 rounded border border-[#222] text-[#3a3a3a]">BROADCAST</span>
          )}
        </div>
      </div>
    </button>
  );
}

interface MsgDetailProps {
  msg: DbMessage | null; isGlobalRead: boolean;
  onDelete: (id: string, isGlobal: boolean) => void;
  onRead: (id: string, isGlobal: boolean) => void;
  onBack?: () => void;
}
function MsgDetail({ msg, isGlobalRead, onDelete, onRead, onBack }: MsgDetailProps) {
  if (!msg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
        <i className="fas fa-inbox text-5xl mb-4 text-[#333]" />
        <div className="font-heavy text-lg text-[#444] tracking-widest mb-1">SELECT A MESSAGE</div>
        <div className="font-mono text-[10px] text-[#333]">Click any message on the left to view details</div>
      </div>
    );
  }
  const resolvedType = (msg.msg_type ?? msg.type) as MsgType;
  const cfg = TYPE_CONFIG[resolvedType] ?? TYPE_CONFIG.system;
  const isGlobal = msg.user_id === null;
  const isUnread = isGlobal ? !isGlobalRead : !msg.is_read;
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-[#1a1a1a] px-5 py-4 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-all mr-1">
            <i className="fas fa-arrow-left text-sm" />
          </button>
        )}
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.ring} ${cfg.bg}`}>
          <i className={`fas ${cfg.icon} text-sm ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-heavy text-base text-white truncate">{msg.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${cfg.ring} ${cfg.text}`}>{resolvedType.toUpperCase()}</span>
            {isGlobal && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[#222] text-[#555]">BROADCAST</span>}
            {isUnread && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-signal/10 border border-signal/30 text-signal">UNREAD</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isUnread && (
            <button onClick={() => onRead(msg.id, isGlobal)} className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono border border-[#222] rounded-lg text-[#666] hover:text-[#CCFF00] hover:border-signal/30 transition-all">
              <i className="fas fa-check text-[8px]" /> MARK READ
            </button>
          )}
          <button onClick={() => onDelete(msg.id, isGlobal)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-red-400 hover:bg-red-400/10 transition-all">
            <i className="fas fa-trash-alt text-[10px]" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#111]">
          <i className="fas fa-clock text-[#333] text-xs" />
          <span className="font-mono text-[10px] text-[#444]">
            {new Date(msg.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="ml-auto font-mono text-[9px] text-[#333]">{formatRelativeTime(msg.created_at)}</span>
        </div>
        <div className="font-mono text-sm text-[#bbb] leading-relaxed whitespace-pre-wrap mb-6">{msg.content}</div>
        {msg.action_link && (
          <Link href={msg.action_link} className="inline-flex items-center gap-2 bg-signal text-black text-xs font-bold font-mono px-4 py-2.5 rounded-lg hover:bg-white transition-colors tracking-wider">
            <i className="fas fa-arrow-right text-[10px]" /> VIEW ACTION
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Festival Banner ──────────────────────────────────────────────────────────

function FestivalBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="relative overflow-hidden rounded-xl border border-signal/20 h-28 flex flex-col justify-center px-4 cursor-pointer group hover:border-signal/40 transition-all"
      style={{ boxShadow: '0 0 20px rgba(204,255,0,0.06)' }}
    >
      <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80" alt="HKAIIFF" className="absolute inset-0 w-full h-full object-cover opacity-20 z-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-transparent z-0" />
      <div className="relative z-10">
        <div className="text-[8px] font-mono text-signal tracking-widest mb-1.5 flex items-center gap-1">
          <i className="fas fa-thumbtack text-[7px]" /> PINNED ANNOUNCEMENT
        </div>
        <div className="inline-block bg-signal text-black px-1.5 py-0.5 rounded text-[8px] font-bold mb-2 animate-pulse">● LIVE EVENT</div>
        <h2 className="text-lg font-black tracking-tighter text-white">HKAIIFF 2026</h2>
      </div>
      <i className="absolute right-4 top-1/2 -translate-y-1/2 fas fa-chevron-right text-signal z-10 group-hover:translate-x-1 transition-transform" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE VIEW — 100% 纯净移动端原生布局，零 md: 污染
// ─────────────────────────────────────────────────────────────────────────────

interface MobileViewProps {
  messages: DbMessage[]; loading: boolean; activeTab: TabType;
  setActiveTab: (t: TabType) => void; filtered: DbMessage[];
  unreadCount: number; selectedMsg: DbMessage | null;
  readGlobalMsgs: string[]; isFestivalOpen: boolean;
  setIsFestivalOpen: (v: boolean) => void; mobileDetailOpen: boolean;
  onSelectMsg: (msg: DbMessage) => void; onMarkAllRead: () => void;
  onRead: (id: string, isGlobal: boolean) => void;
  onDelete: (id: string, isGlobal: boolean) => void;
  onMobileBack: () => void; lang: string;
}

function MobileMessagesView({
  loading, activeTab, setActiveTab, filtered, unreadCount, selectedMsg,
  readGlobalMsgs, isFestivalOpen, setIsFestivalOpen, mobileDetailOpen,
  onSelectMsg, onMarkAllRead, onRead, onDelete, onMobileBack, lang,
}: MobileViewProps) {
  const { t } = useI18n();
  return (
    /* Logo 已移除（仅 /me 显示），顶部 pt-16；BottomNav=50px，pb-16 足够 */
    <div className="min-h-screen w-full bg-[#050505] pt-16 pb-16">

      {/* Panel header */}
      <div className="px-4 pb-3 border-b border-[#1a1a1a]">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h1 className="font-heavy text-2xl text-white tracking-wide leading-none">MESSAGES</h1>
            {unreadCount > 0 && (
              <p className="text-[9px] font-mono text-signal mt-1 tracking-widest">{unreadCount} UNREAD</p>
            )}
          </div>
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono text-[#555] border border-[#222] rounded-lg hover:text-signal hover:border-signal/30 transition-all active:scale-90"
          >
            <i className="fas fa-check-double text-[8px]" /> ALL READ
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-4 border-b border-[#111] -mb-3 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`pb-2.5 text-[10px] font-mono tracking-wider border-b-2 transition-all duration-150 ${
                activeTab === tab.value ? 'border-signal text-white' : 'border-transparent text-[#555] hover:text-[#888]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Festival Banner — 仅移动端有此横幅 */}
      <div className="px-3 pt-3 pb-2">
        <FestivalBanner onOpen={() => setIsFestivalOpen(true)} />
      </div>

      {/* Message list — 自然流式布局，无内部滚动 */}
      <div className="px-2 pt-1 space-y-0.5">
        {loading ? (
          <div className="px-2 space-y-2 pt-2">
            <MsgSkeleton /><MsgSkeleton /><MsgSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 opacity-40">
            <i className="fas fa-inbox text-3xl mb-3 text-[#444]" />
            <div className="font-heavy text-sm text-[#555] tracking-widest">NO MESSAGES</div>
            <div className="font-mono text-[9px] text-[#444] mt-1">INBOX IS EMPTY</div>
          </div>
        ) : (
          filtered.map((msg) => (
            <MsgListItem
              key={msg.id} msg={msg}
              isGlobalRead={readGlobalMsgs.includes(msg.id)}
              isSelected={false}
              onSelect={onSelectMsg}
            />
          ))
        )}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-[8px] font-mono text-[#2a2a2a] pt-4 pb-2">
            {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}
          </p>
        )}
      </div>

      {/* ── Mobile full-screen detail overlay ──
          z-[1001] sits above BottomNav (z-[999]) */}
      <div
        className={`fixed inset-0 z-[1001] bg-[#050505] flex flex-col transition-transform duration-300 ease-out ${
          mobileDetailOpen && selectedMsg ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <MsgDetail
          msg={selectedMsg}
          isGlobalRead={selectedMsg ? readGlobalMsgs.includes(selectedMsg.id) : false}
          onDelete={onDelete} onRead={onRead} onBack={onMobileBack}
        />
      </div>

      {/* ── Festival full-screen modal ── z-[1002] above detail overlay */}
      <div
        className={`fixed inset-0 z-[1002] bg-[#050505] overflow-y-auto transition-transform duration-500 ease-out ${
          isFestivalOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-[#050505]/95 backdrop-blur-md border-b border-[#1a1a1a] flex items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg md:text-xl font-bold text-white leading-tight">香港AI國際電影節</div>
            <div className="font-heavy text-base text-white/70 tracking-wider leading-none mt-0.5">HKAIIFF 2026</div>
            <div className="text-[9px] font-mono text-[#CCFF00] tracking-widest mt-0.5">FESTIVAL GUIDE</div>
          </div>
          <button
            onClick={() => setIsFestivalOpen(false)}
            className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* ── Full content ── */}
        <div className="pb-32 w-full">

          {/* ① Hero 首屏 */}
          <div className="relative overflow-hidden min-h-[260px] flex flex-col justify-end">
            <img
              src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800"
              alt="HKAIIFF"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
            <div className="relative z-10 px-5 pb-8 pt-16">
              <p className="font-mono text-[9px] text-[#CCFF00] tracking-[0.35em] mb-2 uppercase">
                {t('mobileAbout.heroSub')}
              </p>
              <h1 className="font-heavy text-4xl text-white leading-none tracking-tight mb-3">
                {t('mobileAbout.heroSlogan')}
              </h1>
              <div className="inline-flex flex-col items-center justify-center gap-2 mt-3 px-6 py-4 rounded-2xl border border-[#CCFF00]/60 bg-[#CCFF00]/5 text-[#CCFF00] text-base font-bold tracking-widest text-center shadow-[0_0_15px_rgba(204,255,0,0.1)]">
                {t('mobileAbout.heroDates').split(/｜|\|/).map((part, index) => (
                  <span key={index}>{part.trim()}</span>
                ))}
              </div>
              <p className="mt-6 font-mono text-base text-gray-300 leading-relaxed max-w-sm">
                {t('mobileAbout.heroDesc')}
              </p>
            </div>
          </div>

          <div className="px-4 mt-6 space-y-7">

            {/* ② 時代背景 */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-[#CCFF00]/60 via-[#CCFF00]/20 to-transparent" />
              <div className="p-6">
                <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide">
                  {t('mobileAbout.eraTitle')}
                </h2>
                <p className="font-mono text-base text-gray-300 leading-relaxed">
                  {t('mobileAbout.eraDesc')}
                </p>
              </div>
            </div>

            {/* ③ 香港戰略樞紐 */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-[#00F0FF]/60 via-[#00F0FF]/20 to-transparent" />
              <div className="p-6">
                <p className="font-mono text-[9px] text-[#00F0FF] tracking-[0.3em] mb-2 uppercase">
                  {t('mobileAbout.hkSection')}
                </p>
                <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide">
                  {t('mobileAbout.hkTitle')}
                </h2>
                <p className="font-mono text-base text-gray-300 leading-relaxed mb-5">
                  {t('mobileAbout.hkDesc')}
                </p>
                {/* 4 pillars grid */}
                <div className="flex flex-col gap-3">
                  {[
                    { name: t('mobileAbout.hkPillar1Name'), desc: t('mobileAbout.hkPillar1Desc'), color: '#CCFF00' },
                    { name: t('mobileAbout.hkPillar2Name'), desc: t('mobileAbout.hkPillar2Desc'), color: '#00F0FF' },
                    { name: t('mobileAbout.hkPillar3Name'), desc: t('mobileAbout.hkPillar3Desc'), color: '#9D00FF' },
                    { name: t('mobileAbout.hkPillar4Name'), desc: t('mobileAbout.hkPillar4Desc'), color: '#FFC107' },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="bg-white/[0.02] border border-white/[0.05] hover:border-[#CCFF00]/50 rounded-xl p-4 transition-colors duration-200"
                    >
                      <div
                        className="font-mono text-sm font-bold mb-2 tracking-wider"
                        style={{ color: p.color }}
                      >
                        {p.name}
                      </div>
                      <p className="font-mono text-base text-gray-300 leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ④ 生態價值 — 3 張垂直卡片 */}
            <div>
              <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide">
                {t('mobileAbout.ecoTitle')}
              </h2>
              <div className="space-y-4">
                {[
                  { title: t('mobileAbout.ecoCard1Title'), desc: t('mobileAbout.ecoCard1Desc'), icon: 'fa-shield-alt',  accent: '#CCFF00' },
                  { title: t('mobileAbout.ecoCard2Title'), desc: t('mobileAbout.ecoCard2Desc'), icon: 'fa-globe',       accent: '#00F0FF' },
                  { title: t('mobileAbout.ecoCard3Title'), desc: t('mobileAbout.ecoCard3Desc'), icon: 'fa-map-marker-alt', accent: '#9D00FF' },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="bg-white/[0.02] border border-white/[0.05] hover:border-[#CCFF00]/50 rounded-2xl p-6 flex gap-4 transition-colors duration-200 backdrop-blur-sm"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${card.accent}15`, border: `1px solid ${card.accent}30` }}
                    >
                      <i className={`fas ${card.icon} text-sm`} style={{ color: card.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heavy text-lg text-white mb-2">{card.title}</h3>
                      <p className="font-mono text-base text-gray-300 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑤ 核心優勢 — 列表 */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-[#9D00FF]/60 via-[#9D00FF]/20 to-transparent" />
              <div className="p-6">
                <h2 className="font-heavy text-2xl text-white mb-5 tracking-wide">
                  {t('mobileAbout.advTitle')}
                </h2>
                <div className="space-y-5">
                  {[
                    { title: t('mobileAbout.adv1Title'), desc: t('mobileAbout.adv1Desc'), num: '01' },
                    { title: t('mobileAbout.adv2Title'), desc: t('mobileAbout.adv2Desc'), num: '02' },
                    { title: t('mobileAbout.adv3Title'), desc: t('mobileAbout.adv3Desc'), num: '03' },
                  ].map((adv) => (
                    <div key={adv.num} className="flex gap-4">
                      <div className="font-heavy text-2xl text-[#CCFF00]/20 leading-none w-8 flex-shrink-0 pt-0.5">
                        {adv.num}
                      </div>
                      <div className="flex-1 border-b border-white/[0.04] pb-5 last:border-0 last:pb-0">
                        <h3 className="font-heavy text-lg text-white mb-2">{adv.title}</h3>
                        <p className="font-mono text-base text-gray-300 leading-relaxed">{adv.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ⑥ 未來願景 */}
            <div className="relative overflow-hidden rounded-2xl border border-[#CCFF00]/10 bg-[#CCFF00]/[0.02] p-6"
              style={{ boxShadow: '0 0 40px rgba(204,255,0,0.04)' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#CCFF00]/[0.03] blur-3xl" />
              <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide relative z-10">
                {t('mobileAbout.futureTitle')}
              </h2>
              <p className="font-mono text-base text-gray-300 leading-relaxed relative z-10">
                {t('mobileAbout.futureDesc')}
              </p>
            </div>

            {/* ⑦ 底部 CTA */}
            <button
              onClick={() => setIsFestivalOpen(false)}
              className="w-full bg-[#CCFF00] text-black font-heavy text-base py-4 rounded-xl tracking-[0.15em] active:scale-95 transition-transform hover:bg-white"
            >
              {t('mobileAbout.joinBtn')}
            </button>

          </div>

          {/* ⑧ Unicorn Awards 入口 Banner */}
          <div className="px-4 mt-6">
            <Link
              href="/awards"
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-yellow-400/25 p-5 active:scale-[0.98] transition-transform duration-150"
              style={{
                background: 'linear-gradient(135deg, rgba(255,200,0,0.08) 0%, rgba(5,5,5,0.95) 55%, rgba(204,255,0,0.05) 100%)',
                boxShadow: '0 0 30px rgba(255,200,0,0.1), 0 0 60px rgba(255,200,0,0.05), inset 0 1px 0 rgba(255,215,0,0.12)',
              }}
            >
              {/* corner glow */}
              <div className="pointer-events-none absolute -top-6 -left-6 w-32 h-32 rounded-full bg-[radial-gradient(circle,rgba(255,200,0,0.18),transparent_70%)]" />
              <div className="pointer-events-none absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-[radial-gradient(circle,rgba(204,255,0,0.1),transparent_70%)]" />

              {/* top label row */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-px w-6 bg-[#CCFF00]/60" />
                  <p
                    className="font-mono text-[9px] tracking-[0.35em] uppercase"
                    style={{ color: '#CCFF00', textShadow: '0 0 10px rgba(204,255,0,0.5)' }}
                  >
                    {t('entry.mobileBannerTitle')}
                  </p>
                </div>
                <span
                  className="font-mono text-[8px] px-2 py-0.5 rounded border border-yellow-400/30 text-yellow-300/70"
                  style={{ background: 'rgba(255,200,0,0.06)' }}
                >
                  NEW
                </span>
              </div>

              {/* main content */}
              <div className="relative z-10 flex items-end justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-black text-xl text-white leading-snug tracking-tight mb-1"
                    style={{ textShadow: '0 0 20px rgba(255,200,0,0.15)' }}
                  >
                    {t('entry.mobileBannerDates')}
                  </h3>
                </div>
                {/* CTA button */}
                <span
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] font-bold tracking-widest transition-all duration-200 group-hover:scale-105"
                  style={{
                    background: '#CCFF00',
                    color: '#050505',
                    boxShadow: '0 0 12px rgba(204,255,0,0.35)',
                  }}
                >
                  {t('entry.mobileBannerClick')}
                  <i className="fas fa-arrow-right text-[8px]" />
                </span>
              </div>
            </Link>
          </div>

          {/* ⑨ DynamicLogoWall — 3軌跨界戰略夥伴 Logo 牆 */}
          <div className="mt-6">
            <DynamicLogoWall />
          </div>

          {/* ⑩ 中英雙語版權 Footer */}
          <footer className="w-full flex flex-col items-center justify-center py-10 px-4 mt-2 border-t border-white/[0.04] gap-1.5">
            <p className="text-[10px] text-gray-500 tracking-widest uppercase">© 2026 All Rights Reserved.</p>
            <p className="text-[11px] text-gray-400 font-medium tracking-widest mt-1">香港人工智能國際電影節協會</p>
            <p className="text-[9px] text-gray-600 tracking-widest uppercase">Hong Kong AI International Film Festival Association</p>
          </footer>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP VIEW — 100% 纯净桌面端 Discord 双栏布局，零移动端污染
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopViewProps {
  loading: boolean; activeTab: TabType; setActiveTab: (t: TabType) => void;
  filtered: DbMessage[]; unreadCount: number; selectedMsg: DbMessage | null;
  readGlobalMsgs: string[]; onSelectMsg: (msg: DbMessage) => void;
  onMarkAllRead: () => void; onRead: (id: string, isGlobal: boolean) => void;
  onDelete: (id: string, isGlobal: boolean) => void;
}

function DesktopMessagesView({
  loading, activeTab, setActiveTab, filtered, unreadCount, selectedMsg,
  readGlobalMsgs, onSelectMsg, onMarkAllRead, onRead, onDelete,
}: DesktopViewProps) {
  return (
    /* 桌面端：左 w-80 消息列表 + 右 flex-1 消息详情 */
    <div className="flex h-full overflow-hidden bg-[#050505]">

      {/* Left: Message list (w-80) */}
      <div className="w-80 flex-shrink-0 border-r border-[#1a1a1a] h-full overflow-hidden bg-[#050505] flex flex-col">
        {/* Panel header */}
        <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#1a1a1a]">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h1 className="font-heavy text-2xl text-white tracking-wide leading-none">MESSAGES</h1>
              {unreadCount > 0 && (
                <p className="text-[9px] font-mono text-signal mt-1 tracking-widest">{unreadCount} UNREAD</p>
              )}
            </div>
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono text-[#555] border border-[#222] rounded-lg hover:text-signal hover:border-signal/30 transition-all active:scale-90"
            >
              <i className="fas fa-check-double text-[8px]" /> ALL READ
            </button>
          </div>
          <div className="flex gap-4 border-b border-[#111] -mb-3 pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`pb-2.5 text-[10px] font-mono tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === tab.value ? 'border-signal text-white' : 'border-transparent text-[#555] hover:text-[#888]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {loading ? (
            <div className="px-2 space-y-2 pt-2"><MsgSkeleton /><MsgSkeleton /><MsgSkeleton /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <i className="fas fa-inbox text-3xl mb-3 text-[#444]" />
              <div className="font-heavy text-sm text-[#555] tracking-widest">NO MESSAGES</div>
            </div>
          ) : (
            filtered.map((msg) => (
              <MsgListItem
                key={msg.id} msg={msg}
                isGlobalRead={readGlobalMsgs.includes(msg.id)}
                isSelected={selectedMsg?.id === msg.id}
                onSelect={onSelectMsg}
              />
            ))
          )}
          {!loading && filtered.length > 0 && (
            <p className="text-center text-[8px] font-mono text-[#2a2a2a] pt-4 pb-2">
              {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Right: Detail panel (flex-1) */}
      <div className="flex-1 flex overflow-hidden bg-[#030303]">
        <MsgDetail
          msg={selectedMsg}
          isGlobalRead={selectedMsg ? readGlobalMsgs.includes(selectedMsg.id) : false}
          onDelete={onDelete} onRead={onRead}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ENTRY — Shared data layer, physical component isolation
// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user, ready } = usePrivy();
  const { showToast } = useToast();
  const { t, lang } = useI18n();

  const [activeTab, setActiveTab]         = useState<TabType>('all');
  const [messages, setMessages]           = useState<DbMessage[]>([]);
  const [loading, setLoading]             = useState(true);
  const [hiddenGlobalMsgs, setHiddenGlobalMsgs] = useState<string[]>([]);
  const [readGlobalMsgs, setReadGlobalMsgs]     = useState<string[]>([]);
  const [isFestivalOpen, setIsFestivalOpen]     = useState(false);
  const [selectedMsg, setSelectedMsg]           = useState<DbMessage | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    setHiddenGlobalMsgs(getLocalArray(LS_HIDDEN_KEY));
    setReadGlobalMsgs(getLocalArray(LS_READ_KEY));
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const url = user?.id ? `/api/messages?userId=${encodeURIComponent(user.id)}` : '/api/messages';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) { setMessages([]); return; }
      const json = await res.json();
      setMessages((json.messages as DbMessage[]) ?? []);
    } catch { setMessages([]); } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { if (ready) fetchMessages(); }, [ready, fetchMessages]);

  // Supabase realtime
  useEffect(() => {
    if (!ready) return;
    const channelName = user?.id ? `messages-realtime-${user.id}` : 'messages-realtime-global';
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as DbMessage;
        const isPersonal = user?.id && newMsg.user_id === user.id;
        const isBroadcast = newMsg.user_id === null;
        if (isPersonal || isBroadcast) {
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [newMsg, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as DbMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ready, user?.id]);

  const handleMarkAllRead = async () => {
    const personalIds = messages.filter((m) => m.user_id !== null && !m.is_read).map((m) => m.id);
    const globalIds   = messages.filter((m) => m.user_id === null && !readGlobalMsgs.includes(m.id)).map((m) => m.id);
    if (personalIds.length === 0 && globalIds.length === 0) { showToast('No unread messages', 'info'); return; }
    if (personalIds.length > 0 && user?.id) {
      const res = await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      if (!res.ok) { showToast('Failed to mark messages as read', 'error'); return; }
      setMessages((prev) => prev.map((m) => (m.user_id !== null ? { ...m, is_read: true } : m)));
    }
    if (globalIds.length > 0) {
      const newRead = [...new Set([...readGlobalMsgs, ...globalIds])];
      setReadGlobalMsgs(newRead);
      setLocalArray(LS_READ_KEY, newRead);
    }
    showToast('ALL MESSAGES MARKED AS READ', 'success');
  };

  const handleRead = async (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      if (readGlobalMsgs.includes(id)) return;
      const updated = [...readGlobalMsgs, id];
      setReadGlobalMsgs(updated);
      setLocalArray(LS_READ_KEY, updated);
    } else {
      const msg = messages.find((m) => m.id === id);
      if (!msg || msg.is_read) return;
      await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, userId: user?.id }) });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
      if (selectedMsg?.id === id) setSelectedMsg((prev) => prev ? { ...prev, is_read: true } : null);
    }
  };

  const handleDelete = async (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      const updated = [...hiddenGlobalMsgs, id];
      setHiddenGlobalMsgs(updated);
      setLocalArray(LS_HIDDEN_KEY, updated);
      showToast('MESSAGE HIDDEN', 'info');
    } else {
      if (!user?.id) return;
      const res = await fetch(`/api/messages?id=${id}&userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      if (!res.ok) { showToast('Failed to delete message', 'error'); return; }
      setMessages((prev) => prev.filter((m) => m.id !== id));
      showToast('MESSAGE DELETED', 'success');
    }
    if (selectedMsg?.id === id) { setSelectedMsg(null); setMobileDetailOpen(false); }
  };

  const handleSelectMsg = (msg: DbMessage) => {
    setSelectedMsg(msg);
    setMobileDetailOpen(true);
    const isGlobal = msg.user_id === null;
    const isUnread = isGlobal ? !readGlobalMsgs.includes(msg.id) : !msg.is_read;
    if (isUnread) handleRead(msg.id, isGlobal);
  };

  const filtered = messages
    .filter((m) => !hiddenGlobalMsgs.includes(m.id))
    .filter((m) => {
      if (activeTab === 'all') return true;
      const tp = (m.msg_type ?? m.type) as string;
      if (activeTab === 'renders') return tp === 'renders';
      if (activeTab === 'on-chain') return tp === 'on-chain';
      return true;
    });

  const unreadCount = filtered.filter((m) =>
    m.user_id === null ? !readGlobalMsgs.includes(m.id) : !m.is_read
  ).length;

  // Shared props for both views
  const sharedProps = {
    loading, activeTab, setActiveTab, filtered, unreadCount, selectedMsg,
    readGlobalMsgs, onSelectMsg: handleSelectMsg, onMarkAllRead: handleMarkAllRead,
    onRead: handleRead, onDelete: handleDelete,
  };

  return (
    <>
      {/* ══ MOBILE: 完全独立的移动端视图 ══ */}
      <div className="block md:hidden h-full">
        <MobileMessagesView
          {...sharedProps}
          messages={messages}
          isFestivalOpen={isFestivalOpen}
          setIsFestivalOpen={setIsFestivalOpen}
          mobileDetailOpen={mobileDetailOpen}
          onMobileBack={() => setMobileDetailOpen(false)}
          lang={lang}
        />
      </div>

      {/* ══ DESKTOP: 完全独立的桌面端 Discord 双栏视图 ══ */}
      <div className="hidden md:block h-full">
        <DesktopMessagesView {...sharedProps} />
      </div>
    </>
  );
}
```

### app/creator/[userId]/page.tsx
```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import IdentityBadges from "@/app/components/IdentityBadges";
import { buildOssUrl } from "@/lib/utils/oss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  name: string;
  role: string;
}

interface CreatorProfile {
  id: string;
  display_name: string | null;
  name: string | null;
  avatar_seed: string | null;
  bio: string | null;
  tech_stack: string | null;
  core_team: TeamMember[] | null;
  verified_identities: string[];
  portfolio: string | null;
}

interface ApprovedFilm {
  id: string;
  title: string;
  studio: string | null;
  poster_url: string | null;
  ai_ratio: number | null;
  tech_stack: string | null;
  created_at: string;
  trailer_url: string | null;
  status: string;
}

// ─── Film Card ────────────────────────────────────────────────────────────────

function FilmCard({ film }: { film: ApprovedFilm }) {
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const aiPct = film.ai_ratio != null ? Math.round(film.ai_ratio * 100) : null;

  return (
    <Link href={`/film/${film.id}`} className="block">
      <div className="relative overflow-hidden rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] group cursor-pointer hover:border-signal/30 transition-all duration-300">
        {/* Poster */}
        <div className="relative w-full aspect-[2/3] bg-[#111] overflow-hidden">
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={film.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <i className="fas fa-film text-3xl text-[#2a2a2a]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
          {/* AI Ratio badge */}
          {aiPct != null && (
            <div className="absolute top-2 right-2 bg-black/80 border border-signal/40 text-signal text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur">
              AI {aiPct}%
            </div>
          )}
          {/* Status badge */}
          {film.status !== "approved" && (
            <div className="absolute top-2 left-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur uppercase">
              {film.status}
            </div>
          )}
        </div>
        {/* Info */}
        <div className="p-3">
          <h3 className="font-bold text-white text-xs leading-snug tracking-wide uppercase mb-1 line-clamp-2">
            {film.title}
          </h3>
          {film.tech_stack && (
            <p className="text-gray-500 text-[10px] font-mono truncate">
              {film.tech_stack.split(",")[0]?.trim()}
            </p>
          )}
          <div className="text-[9px] font-mono text-gray-700 mt-1.5">
            {new Date(film.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short" })}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CreatorPage() {
  const params = useParams();
  const router = useRouter();
  // URL 参数已经被 Next.js 自动 decode，支持 did:privy:xxx 格式
  const rawUserId = params?.userId as string;
  const userId = rawUserId ? decodeURIComponent(rawUserId) : rawUserId;

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [films, setFilms] = useState<ApprovedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      // 先尝试用 id 字段查询（users.id 可能是 UUID 或 Privy DID）
      const [profileRes, filmsRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, display_name, name, avatar_seed, bio, tech_stack, core_team, verified_identities, portfolio")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("films")
          .select("id, title, studio, poster_url, ai_ratio, tech_stack, created_at, trailer_url, status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      // 如果 id 字段没匹配到，尝试用 privy_id 字段再查一次（兼容双字段场景）
      let finalProfileData = profileRes.data;
      if (!finalProfileData) {
        const fallback = await supabase
          .from("users")
          .select("id, display_name, name, avatar_seed, bio, tech_stack, core_team, verified_identities, portfolio")
          .eq("privy_id", userId)
          .maybeSingle();
        if (fallback.data) finalProfileData = fallback.data;
      }

      const allFilms = (filmsRes.data ?? []) as ApprovedFilm[];

      if (!finalProfileData) {
        // 资料未完善但有作品：显示最小化占位页
        if (allFilms.length > 0) {
          setProfile({
            id: userId,
            display_name: null,
            name: null,
            avatar_seed: userId,
            bio: null,
            tech_stack: null,
            core_team: null,
            verified_identities: [],
            portfolio: null,
          });
          setFilms(allFilms);
          setLoading(false);
          return;
        }
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(finalProfileData as CreatorProfile);
      setFilms(allFilms);
      setLoading(false);
    }
    fetchData();
  }, [userId]);

  const avatarUrl = profile
    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile.avatar_seed ?? profile.id)}`
    : "";

  const techChips = profile?.tech_stack
    ? profile.tech_stack.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const approvedFilms = films.filter((f) => f.status === "approved");

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin" />
          <span className="text-signal font-mono text-xs tracking-widest">LOADING PROFILE...</span>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <i className="fas fa-user-slash text-4xl text-gray-700" />
        <h1 className="font-bold text-xl text-gray-400 tracking-widest uppercase">Creator Not Found</h1>
        <p className="text-gray-600 text-sm font-mono max-w-xs">
          This creator profile does not exist.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 border border-signal/40 text-signal font-mono text-xs tracking-widest rounded hover:bg-signal/10 transition-colors"
        >
          ← GO BACK
        </button>
      </div>
    );
  }

  const displayName =
    profile.display_name ||
    (profile.name && profile.name !== "New Agent" ? profile.name : null) ||
    "ANONYMOUS STUDIO";

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-20">

      {/* ─── Header Banner ─────────────────────────────────────────────────── */}
      <div className="relative h-52 w-full bg-black overflow-hidden flex-shrink-0">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(204,255,0,0.1) 2px, rgba(204,255,0,0.1) 4px)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#050505]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform z-20 outline-none focus:outline-none"
        >
          <i className="fas fa-arrow-left" />
        </button>

        {/* Header label */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333] z-20 whitespace-nowrap">
          STUDIO PROFILE
        </div>
      </div>

      {/* ─── Profile Content ───────────────────────────────────────────────── */}
      <div className="px-4 -mt-14 relative z-10 flex-1">

        {/* Avatar + identity badges */}
        <div className="flex items-end gap-3 mb-3">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              className={`w-24 h-24 border-4 border-[#050505] rounded-full bg-black shadow-[0_0_20px_rgba(204,255,0,0.2)] p-1 relative z-20
                ${(profile.verified_identities ?? []).includes("institution") ? "ring-2 ring-[#9D00FF]"
                  : (profile.verified_identities ?? []).includes("creator") ? "ring-2 ring-signal"
                  : (profile.verified_identities ?? []).includes("curator") ? "ring-2 ring-[#FFC107]"
                  : ""}`}
            />
          </div>
        </div>

        {/* Name + verified badges */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-bold text-2xl text-white uppercase tracking-wide leading-none">
            {displayName}
          </h1>
          <IdentityBadges
            verifiedIdentities={profile.verified_identities ?? []}
            variant="icon"
          />
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-gray-500 mb-5 border-b border-[#1a1a1a] pb-4 mt-2">
          <span className="flex items-center gap-1.5 text-gray-400">
            <i className="fas fa-film text-signal text-xs" />
            {approvedFilms.length} Official Selection{approvedFilms.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5 text-signal">
            <i className="fas fa-robot text-xs" />
            AI-NATIVE STUDIO
          </span>
          {(profile.verified_identities ?? []).length > 0 && (
            <span className="flex items-center gap-1.5 text-[#D4AF37]">
              <i className="fas fa-certificate text-xs" />
              HKAIIFF VERIFIED
            </span>
          )}
        </div>

        <div className="space-y-6">

          {/* ABOUT STUDIO */}
          <section>
            <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-signal pl-3 uppercase tracking-widest">
              About Studio
            </h2>
            <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
              <p className="text-xs text-gray-300 font-mono leading-relaxed">
                {profile.bio?.trim()
                  ? profile.bio
                  : "No studio information provided. This node operates in stealth mode — its rendering pipeline and creative philosophy remain undisclosed."}
              </p>
            </div>
          </section>

          {/* TECH STACK */}
          {techChips.length > 0 && (
            <section>
              <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-white/40 pl-3 uppercase tracking-widest">
                Tech Stack
              </h2>
              <div className="flex flex-wrap gap-2">
                {techChips.map((chip, i) => (
                  <span
                    key={i}
                    className="bg-[#0a0a0a] border border-[#333] text-signal text-[10px] font-mono px-2.5 py-1 rounded-full"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* PORTFOLIO */}
          {profile.portfolio?.trim() && (
            <section>
              <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-blue-400/60 pl-3 uppercase tracking-widest">
                Portfolio
              </h2>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <p className="text-xs text-gray-300 font-mono leading-relaxed">{profile.portfolio}</p>
              </div>
            </section>
          )}

          {/* CORE TEAM */}
          {profile.core_team && profile.core_team.length > 0 && (
            <section>
              <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-[#444] pl-3 uppercase tracking-widest">
                Core Team
              </h2>
              <div className="space-y-2">
                {profile.core_team.map((member, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3"
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(member.name)}`}
                      alt={member.name}
                      className="w-9 h-9 rounded-full border border-[#333] bg-black shrink-0"
                    />
                    <div>
                      <div className="text-sm font-bold text-white">{member.name}</div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                        {member.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* OFFICIAL SELECTIONS */}
          <section>
            <h2 className="font-bold text-sm text-white mb-1 border-l-4 border-[#D4AF37] pl-3 uppercase tracking-widest flex items-center gap-2">
              Official Selections
              <span className="text-[#D4AF37] text-xs font-mono">({approvedFilms.length})</span>
            </h2>
            <p className="text-[10px] font-mono text-gray-600 mb-3 pl-3">
              Films approved by the HKAIIFF Jury
            </p>
            {approvedFilms.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-dashed border-[#222] rounded-xl py-10 flex flex-col items-center gap-3">
                <i className="fas fa-film text-2xl text-[#2a2a2a]" />
                <span className="text-[11px] font-mono text-gray-600 tracking-widest">NO OFFICIAL SELECTIONS YET</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {approvedFilms.map((film) => (
                  <FilmCard key={film.id} film={film} />
                ))}
              </div>
            )}
          </section>

          {/* ALL SUBMISSIONS (if there are non-approved ones too) */}
          {films.filter(f => f.status !== "approved").length > 0 && (
            <section>
              <h2 className="font-bold text-sm text-gray-500 mb-2 border-l-4 border-[#333] pl-3 uppercase tracking-widest">
                Other Submissions
                <span className="ml-2 text-gray-700 font-mono">({films.filter(f => f.status !== "approved").length})</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {films.filter(f => f.status !== "approved").map((film) => (
                  <FilmCard key={film.id} film={film} />
                ))}
              </div>
            </section>
          )}

        </div>
      </div>

      {/* ─── Bottom: Back to Feed ───────────────────────────────────────────── */}
      <div className="fixed bottom-[50px] left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-3 px-4 z-40">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-signal text-black font-bold text-sm tracking-widest rounded-xl active:scale-95 transition-transform"
        >
          <i className="fas fa-film" />
          BACK TO FESTIVAL FEED
        </Link>
      </div>

    </div>
  );
}
```

## 共享组件
### components/Providers.tsx
```typescript
"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'google', 'twitter', 'discord'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        } as any,
        externalWallets: {
          walletConnect: { enabled: true },
        },
        supportedChains: [{
          id: 101,
          name: 'Solana',
          network: 'solana-mainnet',
          nativeCurrency: { name: 'SOL', symbol: 'SOL', decimals: 9 },
          rpcUrls: { default: { http: ['https://api.mainnet-beta.solana.com'] } },
        }],
        appearance: {
          theme: 'dark',
          accentColor: '#9AFF12',
          showWalletLoginFirst: true,
          walletList: [
            'phantom',
            'metamask',
            'wallet_connect',
            'detected_solana_wallets',
            'detected_ethereum_wallets',
          ],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

### components/FeedVideo.tsx
```typescript
"use client";

/**
 * components/FeedVideo.tsx
 *
 * 高性能 Feed 流视频播放器（HLS 懒加载 + 旧 MP4 智能兼容）
 *
 * 核心省流策略：
 *  - IntersectionObserver 监听视口，可见度 ≥ threshold 才初始化播放
 *  - 滑出视口立即 pause() + hls.destroy()，彻底掐断 HLS 分片下载
 *  - 原生 MP4 / OSS 链接在滑出时同样 pause() + 清空 src，阻止后台缓冲
 *
 * 智能兼容策略（无需外部判断）：
 *  1. src 含 .m3u8 → hls.js 初始化（Chrome/Android/PC）
 *  2. src 含 .m3u8 + Safari/iOS → 原生 HLS（video.canPlayType 检测）
 *  3. src 含 .mp4 / oss / 其他 → 原生 <video src> 兼容播放（旧数据无缝过渡）
 */

import { useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FeedVideoProps {
  /** HLS m3u8 地址 或 旧版 MP4/OSS 直链（自动判断） */
  src?: string;
  /** 封面图 URL，视频加载前展示，节省首屏流量 */
  poster?: string;
  /** className 透传给 <video> 标签 */
  className?: string;
  /** style 透传给 <video> 标签 */
  style?: React.CSSProperties;
  /** 是否静音（外部可控，默认 true） */
  muted?: boolean;
  /** 是否循环播放（默认 true） */
  loop?: boolean;
  /**
   * 进入视口判定阈值（0~1），默认 0.5
   * 即视频面积超过 50% 进入屏幕时才开始播放
   */
  visibilityThreshold?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 判断是否为 HLS 流地址 */
function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedVideo({
  src,
  poster,
  className,
  style,
  muted = true,
  loop = true,
  visibilityThreshold = 0.5,
}: FeedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // ── 销毁 HLS + 暂停（滑出视口 / 卸载时调用） ──────────────────────────────
  const teardown = useCallback(() => {
    const video = videoRef.current;

    if (video) {
      video.pause();
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
      console.log("[FeedVideo] Hls 实例已销毁，分片下载已中断");
    }

    // 清空 src，阻止浏览器后台继续缓冲
    if (video && video.src) {
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  // ── 初始化播放（滑入视口时调用） ──────────────────────────────────────────
  const init = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // 防止重复初始化
    if (hlsRef.current) return;
    if (video.src && !video.src.endsWith("about:blank") && video.src !== window.location.href) return;

    if (isHlsUrl(src)) {
      // ── HLS 分支 ────────────────────────────────────────────────────────────
      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1,       // 自动选择起始画质
          maxBufferLength: 10,  // 最大缓冲 10s，节省内存与带宽
          maxMaxBufferLength: 20,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("[FeedVideo] HLS 致命错误，类型:", data.type, data);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("[FeedVideo] 网络错误，尝试恢复...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("[FeedVideo] 媒体错误，尝试恢复...");
                hls.recoverMediaError();
                break;
              default:
                console.error("[FeedVideo] 不可恢复错误，销毁实例");
                teardown();
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((err) => {
            console.error("[FeedVideo] HLS 自动播放被浏览器拦截:", err);
          });
        });

        hls.loadSource(src);
        hls.attachMedia(video);
        console.log("[FeedVideo] HLS (hls.js) 初始化，URL:", src);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari / iOS 原生 HLS
        video.src = src;
        video.load();
        video.play().catch((err) => {
          console.error("[FeedVideo] Safari 原生 HLS 自动播放被拦截:", err);
        });
        console.log("[FeedVideo] HLS (Safari 原生) 播放，URL:", src);
      } else {
        console.error("[FeedVideo] 浏览器不支持 HLS，URL:", src);
      }
    } else {
      // ── MP4 / OSS / 其他原生格式（旧数据无缝兼容）───────────────────────────
      video.src = src;
      video.load();
      video.play().catch((err) => {
        console.error("[FeedVideo] MP4/原生 自动播放被拦截:", err);
      });
      console.log("[FeedVideo] 原生 MP4 播放，URL:", src);
    }
  }, [src, teardown]);

  // ── IntersectionObserver：进入视口 → 初始化，离开 → 销毁 ──────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= visibilityThreshold) {
          init();
        } else {
          teardown();
        }
      },
      { threshold: [0, visibilityThreshold, 1] }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      teardown(); // 组件卸载时强制清理，防止内存泄漏
    };
  }, [init, teardown, visibilityThreshold]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      poster={poster}
      muted={muted}
      loop={loop}
      playsInline
      preload="none"
    />
  );
}
```

### components/PrivyLoginWithConsent.tsx
```typescript
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

interface PrivyLoginWithConsentProps {
  /** Controlled mode: parent passes open state (BottomNav / Sidebar / page) */
  open?: boolean;
  onClose?: () => void;
  /** Self-trigger mode: styles and label for the trigger button (DesktopNavbar) */
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function PrivyLoginWithConsent({
  open: controlledOpen,
  onClose,
  triggerClassName,
  triggerLabel = "CONNECT",
}: PrivyLoginWithConsentProps) {
  const { login, authenticated } = usePrivy();
  const [agreed, setAgreed] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  // SSR guard — createPortal requires document
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  // Reset checkbox every time the modal opens fresh
  useEffect(() => {
    if (isOpen) setAgreed(false);
  }, [isOpen]);

  const handleClose = () => {
    setAgreed(false);
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleLogin = () => {
    if (!agreed) return;
    login();
    handleClose();
  };

  if (authenticated) return null;

  // Rendered via portal into document.body so that parent backdrop-filter /
  // transform styles cannot create a new containing block for the fixed overlay.
  const modalOverlay =
    isOpen && isMounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <div className="bg-[#111111] border border-[#252525] rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/60">

              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-white font-heavy text-xl tracking-tighter leading-none">
                    HKAIIFF
                  </h2>
                  <p className="text-[#444] text-[9px] font-mono tracking-widest uppercase mt-1">
                    Hong Kong AI International Film Festival
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#444] transition-all"
                  aria-label="Close"
                >
                  <i className="fas fa-times text-[10px]" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#1e1e1e] mb-5" />

              {/* Consent checkbox */}
              <div className="flex items-start gap-3 mt-4 mb-3">
                <button
                  type="button"
                  id="legal-consent"
                  role="checkbox"
                  aria-checked={agreed}
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    agreed
                      ? "bg-signal border-signal"
                      : "bg-transparent border-[#3a3a3a] hover:border-signal/60"
                  }`}
                >
                  {agreed && <i className="fas fa-check text-[8px] text-black" />}
                </button>
                <label
                  htmlFor="legal-consent"
                  className="text-sm text-[#888] leading-snug cursor-pointer select-none"
                  onClick={() => setAgreed(!agreed)}
                >
                  我已閱讀並同意{" "}
                  <Link
                    href="/terms"
                    className="underline text-white hover:opacity-70 transition-opacity"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    用戶服務協議
                  </Link>
                  {" "}及{" "}
                  <Link
                    href="/privacy"
                    className="underline text-white hover:opacity-70 transition-opacity"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    私隱保護政策
                  </Link>
                </label>
              </div>

              {/* Login button */}
              <button
                onClick={handleLogin}
                disabled={!agreed}
                className={`w-full py-2.5 rounded-xl text-sm font-bold font-mono tracking-wider transition-all mt-2 ${
                  agreed
                    ? "bg-signal text-black hover:bg-white cursor-pointer"
                    : "bg-[#1a1a1a] text-[#3a3a3a] opacity-50 cursor-not-allowed"
                }`}
              >
                登入 / Login
              </button>

              {/* Legal footnote */}
              <p className="text-xs text-[#444] text-center mt-3 leading-relaxed">
                By continuing, you agree to our{" "}
                <Link
                  href="/terms"
                  className="underline hover:text-[#777] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link
                  href="/privacy"
                  className="underline hover:text-[#777] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Self-trigger mode: render the CONNECT button */}
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className={
            triggerClassName ??
            "bg-signal text-black text-[10px] font-bold font-mono px-4 py-1.5 rounded-full hover:bg-white transition-colors tracking-wider"
          }
        >
          {triggerLabel}
        </button>
      )}
      {modalOverlay}
    </>
  );
}
```

### app/components/ClientProviders.tsx
```typescript
"use client";

import { ModalProvider } from "@/app/context/ModalContext";
import { I18nProvider } from "@/app/context/I18nContext";
import { ToastProvider } from "@/app/context/ToastContext";
import ProfileCompletionGuard from "@/app/components/ProfileCompletionGuard";
import { ReactNode } from "react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ModalProvider>
        <ToastProvider>
          <ProfileCompletionGuard>
            {children}
          </ProfileCompletionGuard>
        </ToastProvider>
      </ModalProvider>
    </I18nProvider>
  );
}
```

## 运维脚本
### scripts/sweep_aif.ts
```typescript
/**
 * ============================================================
 * AIF Token 資金歸集機器人 (Sweep Bot)
 * ============================================================
 * 功能：掃描 Supabase 數據庫中所有持有 AIF 代幣的用戶充值地址，
 *       並將餘額全部歸集到官方總金庫錢包 (TREASURY_WALLET)。
 *       若用戶 SOL 不足，自動由 Fee Payer 熱錢包墊付 Gas 費。
 *
 * 運行方式：npx ts-node scripts/sweep_aif.ts
 *
 * 安全警告：
 *   - 本腳本使用 MASTER_SEED_PHRASE 動態派生私鑰，屬極度敏感操作。
 *   - 務必只在安全、隔離的伺服器環境中執行，嚴禁在前端或公開環境運行。
 *   - 生產環境建議通過 AWS Secrets Manager 或 Vault 管理主助記詞。
 * ============================================================
 */

// 加載 .env.local 環境變量（必須在所有模塊引入之前執行）
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';

// ============================================================
// 環境變量校驗
// ============================================================

/** 校驗必要的環境變量是否已設定，缺少則直接終止腳本 */
function assertEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[環境錯誤] 缺少必要的環境變量：${key}，請檢查 .env.local 文件。`);
  }
  return value.trim();
}

// ============================================================
// 全局常量初始化
// ============================================================

/** Solana RPC 連接（優先使用自定義 RPC，降低被限流風險） */
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');

/** Supabase 服務端客戶端（使用 SERVICE_ROLE_KEY，可繞過 RLS 讀取所有用戶數據） */
const supabase = createClient(
  assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
  assertEnv('SUPABASE_SERVICE_ROLE_KEY')
);

/** 官方總金庫地址（AIF 最終歸集目標） */
const TREASURY_WALLET = new PublicKey(assertEnv('TREASURY_WALLET'));

/** AIF 代幣的 Mint 合約地址 */
const AIF_MINT_ADDRESS = new PublicKey(assertEnv('NEXT_PUBLIC_AIF_MINT_ADDRESS'));

/**
 * Fee Payer 熱錢包 Keypair（用於自動墊付 Gas 費）。
 * 從 FEE_PAYER_PRIVATE_KEY 讀取 Base58 格式的私鑰並還原。
 */
const feePayerKeypair: Keypair = (() => {
  const rawKey = assertEnv('FEE_PAYER_PRIVATE_KEY');
  try {
    const decoded = bs58.decode(rawKey);
    return Keypair.fromSecretKey(decoded);
  } catch {
    throw new Error(
      '[密鑰錯誤] FEE_PAYER_PRIVATE_KEY 格式無效，請確認是否為合法的 Base58 私鑰。'
    );
  }
})();

/**
 * 每次墊付的固定 SOL 數量（lamports）。
 * 包含租金豁免緩衝 + 多次交易手續費，足夠執行歸集操作。
 */
const RENT_AND_GAS_FEE = 0.002 * LAMPORTS_PER_SOL;

/**
 * 觸發自動墊付的 SOL 閾值（單位：SOL）。
 * 低於此值時由 Fee Payer 自動補充。
 */
const MINIMUM_SOL_FOR_GAS = 0.002;

// ============================================================
// 輔助函數
// ============================================================

/**
 * 通過主助記詞和 BIP44 路徑派生指定索引的 Solana Keypair。
 * 派生路徑格式：m/44'/501'/{walletIndex}'/0'
 * 其中 501 是 Solana 的 SLIP-44 幣種編號。
 *
 * @param walletIndex - 用戶在 HD 錢包中的索引號（從 0 開始）
 * @returns 派生出的 Solana Keypair
 */
function deriveKeypair(walletIndex: number): Keypair {
  const mnemonic = assertEnv('MASTER_SEED_PHRASE');

  // 驗證助記詞格式是否合法
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('[密鑰錯誤] MASTER_SEED_PHRASE 格式無效，請確認助記詞是否正確。');
  }

  // 將助記詞轉換為 seed buffer
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // 按 BIP44 標準派生路徑（Solana 使用 coin type 501）
  const derivationPath = `m/44'/501'/${walletIndex}'/0'`;
  const { key } = derivePath(derivationPath, seed.toString('hex'));

  return Keypair.fromSeed(key);
}

/**
 * 等待指定毫秒數（用於防止 RPC 節點限流）
 * @param ms - 等待毫秒數
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 核心歸集邏輯
// ============================================================

/**
 * 處理單個用戶錢包的 AIF 歸集任務。
 *
 * 流程：
 * 1. 派生用戶私鑰
 * 2. 安全校驗（核對公鑰與數據庫地址是否一致）
 * 3. 查詢 AIF 代幣餘額
 * 4. 檢查 SOL Gas 費是否充足
 * 5. 執行轉帳交易
 *
 * @param walletIndex    - 用戶在 HD 錢包中的索引
 * @param depositAddress - 數據庫中存儲的用戶充值地址（用於安全校驗）
 */
async function processUserWallet(
  walletIndex: number,
  depositAddress: string,
  userId: string,
  mintDecimals: number,
): Promise<void> {
  console.log(`\n📋 開始處理 | 索引：${walletIndex} | 地址：${depositAddress}`);

  // ----------------------------------------------------------
  // Step 1：動態派生用戶 Keypair
  // ----------------------------------------------------------
  let userKeypair: Keypair;
  try {
    userKeypair = deriveKeypair(walletIndex);
  } catch (err) {
    console.error(`  ❌ [密鑰派生失敗] walletIndex=${walletIndex}，原因：${(err as Error).message}`);
    return; // 跳過此用戶，繼續處理下一個
  }

  // ----------------------------------------------------------
  // Step 2：安全校驗 —— 核對派生公鑰與數據庫地址是否完全一致
  // 這是防止因索引錯亂導致誤轉他人資金的關鍵安全防線
  // ----------------------------------------------------------
  const derivedAddress = userKeypair.publicKey.toBase58();
  if (derivedAddress !== depositAddress) {
    console.error(
      `  ❌ [安全校驗失敗] 派生地址不匹配！\n` +
        `     數據庫地址：${depositAddress}\n` +
        `     派生地址：  ${derivedAddress}\n` +
        `     已跳過，防止誤操作。`
    );
    console.info(
      `  💡 提示：若為測試環境更換了助記詞，請執行 npm run reset-wallets 清除舊錢包數據後重新生成地址。`
    );
    return; // 地址不符，立即跳過，不執行任何轉帳
  }
  console.log(`  ✅ 安全校驗通過`);

  // ----------------------------------------------------------
  // Step 3：查詢 AIF 代幣餘額
  // ----------------------------------------------------------
  let aifBalance = BigInt(0);
  let userATA: PublicKey;

  try {
    // 獲取用戶的 AIF Associated Token Account (ATA) 地址
    userATA = await getAssociatedTokenAddress(AIF_MINT_ADDRESS, userKeypair.publicKey);

    // 嘗試獲取 ATA 賬戶信息（如果賬戶不存在會拋出異常）
    const tokenAccount = await getAccount(connection, userATA);
    aifBalance = tokenAccount.amount;
  } catch {
    // ATA 賬戶不存在，說明該地址從未持有 AIF，直接跳過
    console.log(`  ⏭️  [跳過] ATA 賬戶不存在，餘額為 0`);
    return;
  }

  // 餘額為 0，跳過
  if (aifBalance === BigInt(0)) {
    console.log(`  ⏭️  [跳過] 餘額為 0`);
    return;
  }

  console.log(`  💰 AIF 餘額：${aifBalance.toString()} (最小單位)`);

  // ----------------------------------------------------------
  // Step 4：檢查 SOL 餘額，不足則由 Fee Payer 自動墊付
  // ----------------------------------------------------------
  const solBalance = await connection.getBalance(userKeypair.publicKey);
  const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;

  if (solBalance < RENT_AND_GAS_FEE) {
    console.log(
      `  ⛽ [準備墊付] 用戶地址 SOL 不足（當前：${solBalanceInSol.toFixed(6)} SOL），` +
        `正在從 Fee Payer 墊付 0.002 SOL...`
    );

    try {
      const fundTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: feePayerKeypair.publicKey,
          toPubkey: userKeypair.publicKey,
          lamports: RENT_AND_GAS_FEE,
        })
      );

      const fundSig = await sendAndConfirmTransaction(
        connection,
        fundTx,
        [feePayerKeypair],
        { commitment: 'confirmed' }
      );

      console.log(
        `  ✅ [墊付成功] 交易 Hash: ${fundSig}\n` +
          `      查看：https://solscan.io/tx/${fundSig}`
      );
    } catch (fundErr) {
      console.error(
        `  ❌ [墊付失敗] 無法為地址 ${depositAddress} 墊付 SOL\n` +
          `      原因：${(fundErr as Error).message}\n` +
          `      已跳過此用戶，防止卡死。`
      );
      return;
    }
  } else {
    console.log(`  ⛽ SOL 餘額充足：${solBalanceInSol.toFixed(6)} SOL，無需墊付`);
  }

  // ----------------------------------------------------------
  // Step 5：獲取金庫的 AIF ATA 地址（歸集目標）
  // ----------------------------------------------------------
  const treasuryATA = await getAssociatedTokenAddress(AIF_MINT_ADDRESS, TREASURY_WALLET);

  // ----------------------------------------------------------
  // Step 6：構建並發送 AIF 轉帳交易
  // ----------------------------------------------------------
  try {
    const transaction = new Transaction().add(
      createTransferInstruction(
        userATA,           // 來源：用戶的 AIF ATA
        treasuryATA,       // 目標：金庫的 AIF ATA
        userKeypair.publicKey, // 授權人：用戶自身
        aifBalance,        // 數量：全部餘額
        [],                // 多簽列表（此處不需要）
        TOKEN_PROGRAM_ID   // SPL Token 程序 ID
      )
    );

    // 發送並等待交易確認
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [userKeypair], // 由用戶 Keypair 簽名授權
      { commitment: 'confirmed' }
    );

    console.log(
      `  ✅ [成功] 歸集完成！\n` +
        `      金額：${aifBalance.toString()} AIF (最小單位)\n` +
        `      交易哈希：${signature}\n` +
        `      查看：https://solscan.io/tx/${signature}`
    );

    // ----------------------------------------------------------
    // Step 7：同步 Supabase 內部帳本餘額
    // ----------------------------------------------------------
    try {
      const { data: userData, error: fetchErr } = await supabase
        .from('users')
        .select('aif_balance')
        .eq('id', userId)
        .single();

      if (fetchErr) throw new Error(`查詢帳本餘額失敗: ${fetchErr.message}`);

      const currentBalance: number = userData?.aif_balance ?? 0;
      const sweptAmountUi = Number(aifBalance) / Math.pow(10, mintDecimals);
      const newBalance = currentBalance + sweptAmountUi;

      const { error: updateErr } = await supabase
        .from('users')
        .update({ aif_balance: newBalance })
        .eq('id', userId);

      if (updateErr) throw new Error(`更新帳本餘額失敗: ${updateErr.message}`);

      console.log(
        `  ✅ Supabase 餘額更新成功（${currentBalance} + ${sweptAmountUi} = ${newBalance} AIF）`
      );
    } catch (dbErr) {
      console.error(`  ❌ [Supabase 更新失敗] ${(dbErr as Error).message}`);
    }
  } catch (txErr) {
    // 交易失敗（可能是網絡問題、賬戶狀態變化等），記錄錯誤後繼續處理下一個用戶
    console.error(
      `  ❌ [交易失敗] 地址：${depositAddress}\n` +
        `      原因：${(txErr as Error).message}`
    );
  }
}

// ============================================================
// 主函數
// ============================================================

/**
 * 主函數：從 Supabase 加載用戶列表，逐一執行歸集任務。
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🤖 AIF Token 資金歸集機器人啟動');
  console.log(`   RPC 節點：${RPC_URL}`);
  console.log(`   金庫地址：${TREASURY_WALLET.toBase58()}`);
  console.log(`   AIF Mint：${AIF_MINT_ADDRESS.toBase58()}`);
  console.log(`   Gas 墊付：${feePayerKeypair.publicKey.toBase58()}`);
  console.log('='.repeat(60));

  // ----------------------------------------------------------
  // 從 Supabase 查詢所有擁有充值地址的用戶
  // 條件：deposit_address 和 wallet_index 均不為空
  // ----------------------------------------------------------
  const { data: users, error } = await supabase
    .from('users')
    .select('id, deposit_address, wallet_index')
    .not('deposit_address', 'is', null)
    .not('wallet_index', 'is', null);

  if (error) {
    throw new Error(`[Supabase 錯誤] 查詢用戶列表失敗：${error.message}`);
  }

  if (!users || users.length === 0) {
    console.log('\n📭 未找到任何持有充值地址的用戶，腳本退出。');
    return;
  }

  console.log(`\n📊 共找到 ${users.length} 個用戶賬戶，開始逐一掃描...\n`);

  // ----------------------------------------------------------
  // 預先查詢 AIF Mint 小數位（避免每個錢包重複查詢）
  // ----------------------------------------------------------
  let mintDecimals = 9; // Solana SPL Token 預設值
  try {
    const mintInfo = await getMint(connection, AIF_MINT_ADDRESS);
    mintDecimals = mintInfo.decimals;
    console.log(`   AIF 小數位：${mintDecimals}`);
  } catch (mintErr) {
    console.warn(`⚠️  無法獲取 Mint 小數位，使用預設值 ${mintDecimals}: ${(mintErr as Error).message}`);
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // ----------------------------------------------------------
  // 使用 for...of 順序遍歷（避免並發請求觸發 RPC 限流）
  // ----------------------------------------------------------
  for (const user of users) {
    try {
      await processUserWallet(
        user.wallet_index as number,
        user.deposit_address as string,
        user.id as string,
        mintDecimals,
      );
      successCount++;
    } catch (err) {
      // 捕獲單個用戶處理中的未預期異常，確保整體腳本不中斷
      errorCount++;
      console.error(
        `\n❌ [未捕獲異常] 用戶 ID：${user.id}\n` +
          `   原因：${(err as Error).message}`
      );
    }

    // 每次處理之間等待 1 秒，防止觸發 RPC 節點的 Rate Limit
    await sleep(1000);
  }

  // ----------------------------------------------------------
  // 最終統計報告
  // ----------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('📈 歸集任務完成，統計報告：');
  console.log(`   處理總數：${users.length}`);
  console.log(`   成功/跳過：${successCount}`);
  console.log(`   異常數量：${errorCount}`);
  console.log('='.repeat(60));
}

// ============================================================
// 腳本入口：執行 main()，全局捕獲頂層異常
// ============================================================
main().catch((err) => {
  console.error('\n💥 [致命錯誤] 腳本意外終止：', err.message);
  process.exit(1);
});
```

### scripts/reset_test_wallets.ts
```typescript
/**
 * ============================================================
 * 測試錢包清理腳本 (Reset Test Wallets)
 * ============================================================
 * 功能：將 Supabase users 表中所有用戶的錢包關聯欄位
 *       (deposit_address, wallet_index) 清空為 null。
 *
 * 使用場景：
 *   當測試環境更換了 MASTER_SEED_PHRASE 助記詞後，
 *   舊地址與新助記詞派生出的地址不匹配，導致 sweep_aif.ts
 *   拋出「派生地址不匹配」安全校驗失敗。執行此腳本清除舊地址後，
 *   回前端 ME 頁面重新點擊「Generate Deposit Address」即可生成
 *   與新助記詞對應的新地址。
 *
 * 運行方式：
 *   npm run reset-wallets
 *
 * ⚠️  警告：此操作會清除所有用戶的充值地址綁定，執行前請確認
 *          對應的鏈上餘額已全數歸集或安全處置。
 * ============================================================
 */

// 加載 .env.local 環境變量（必須在所有模塊引入之前執行）
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// ── 終端機彩色輸出輔助 ─────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

function assertEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[環境錯誤] 缺少必要的環境變量：${key}，請檢查 .env.local 文件。`);
  }
  return value.trim();
}

// ── Supabase Admin 客戶端（使用 SERVICE_ROLE_KEY 繞過 RLS） ──────────────────
const supabase = createClient(
  assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
  assertEnv('SUPABASE_SERVICE_ROLE_KEY')
);

// ============================================================
// 主函數
// ============================================================
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`${BOLD}${CYAN}🔧 測試錢包清理腳本啟動${RESET}`);
  console.log('='.repeat(60));

  // ── Step 1：查詢目前持有充值地址的用戶數量 ────────────────────────────────
  const { data: existing, error: countErr } = await supabase
    .from('users')
    .select('id, deposit_address, wallet_index')
    .not('deposit_address', 'is', null);

  if (countErr) {
    throw new Error(`[Supabase 錯誤] 查詢用戶列表失敗：${countErr.message}`);
  }

  const count = existing?.length ?? 0;

  if (count === 0) {
    console.log(`\n${YELLOW}📭 資料庫中目前沒有任何用戶擁有充值地址，無需清理。${RESET}\n`);
    return;
  }

  console.log(`\n${CYAN}📊 找到 ${BOLD}${count}${RESET}${CYAN} 位用戶持有充值地址，準備清空...${RESET}\n`);

  // ── Step 2：批量將 deposit_address 與 wallet_index 更新為 null ──────────
  const { error: updateErr } = await supabase
    .from('users')
    .update({
      deposit_address: null,
      wallet_index: null,
    })
    .not('deposit_address', 'is', null);

  if (updateErr) {
    throw new Error(`[Supabase 錯誤] 清空錢包欄位失敗：${updateErr.message}`);
  }

  // ── Step 3：驗證清理結果 ──────────────────────────────────────────────────
  const { data: remaining, error: verifyErr } = await supabase
    .from('users')
    .select('id')
    .not('deposit_address', 'is', null);

  if (verifyErr) {
    console.warn(`${YELLOW}⚠️  無法驗證清理結果：${verifyErr.message}${RESET}`);
  } else {
    const remainingCount = remaining?.length ?? 0;
    if (remainingCount > 0) {
      console.warn(
        `${YELLOW}⚠️  仍有 ${remainingCount} 位用戶的地址未清空，請手動檢查。${RESET}`
      );
    }
  }

  // ── 成功輸出 ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(
    `${GREEN}${BOLD}✅ 所有測試錢包已成功清空！請回前端重新生成專屬充值地址。${RESET}`
  );
  console.log('='.repeat(60));
  console.log(`\n${CYAN}💡 下一步操作：${RESET}`);
  console.log(`   1. 回到前端 ME 頁面（/me）`);
  console.log(`   2. 點擊 "TOP UP" 按鈕`);
  console.log(`   3. 點擊 "Generate Deposit Address" 重新生成與新助記詞匹配的充值地址\n`);
}

// ============================================================
// 腳本入口
// ============================================================
main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n${RED}${BOLD}💥 [致命錯誤] 腳本意外終止：${msg}${RESET}\n`);
  process.exit(1);
});
```

