import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, BrainCircuit, Check, Code2, 
  Database, LockKeyhole, Menu, ShieldCheck, Sparkles, 
  UploadCloud, X, Zap, 
  Atom, Share2, Server, Flame
} from 'lucide-react';

const GITHUB_LINK = "https://github.com/atulkaushik156/sequelo";
const LINKEDIN_LINK = "https://www.linkedin.com/in/atul-kaushik-2a2605381/";
const ease = [0.22, 1, 0.36, 1];

function Logo({ compact = false }) {
  return (
    <div className="logo" aria-label="Sequelo home">
      <img 
        src="/my-logo.svg" 
        alt="Sequelo Logo" 
        style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
      />
      {!compact && <span>sequelo</span>}
    </div>
  );
}

function GitHubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.22c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.57-.3-5.28-1.29-5.28-5.7 0-1.27.45-2.3 1.2-3.1-.12-.3-.52-1.48.11-3.07 0 0 .98-.31 3.16 1.18a10.95 10.95 0 0 1 5.76 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.23 2.78.11 3.08.75.8 1.2 1.83 1.2 3.09 0 4.43-2.71 5.4-5.3 5.69.42.36.79 1.07.79 2.16v3.2c0 .31.2.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

function DataNetwork() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    let pointer = { x: -1000, y: -1000 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = Array.from({ length: 46 }, (_, index) => ({
      x: (index * 0.618033) % 1,
      y: (index * 0.381966 + 0.12) % 1,
      dx: ((index % 5) - 2) * 0.000035,
      dy: ((index % 7) - 3) * 0.000025,
      r: index % 8 === 0 ? 2 : 1.5,
    }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const points = nodes.map((node) => ({ x: node.x * width, y: node.y * height, r: node.r }));
      if (!reduced) {
        nodes.forEach((node) => {
          node.x = (node.x + node.dx + 1) % 1;
          node.y = (node.y + node.dy + 1) % 1;
        });
      }
      points.forEach((point, index) => {
        points.slice(index + 1).forEach((other) => {
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 155) {
            const alpha = (1 - distance / 155) * 0.16;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(22, 119, 255, ${alpha})`; 
            ctx.lineWidth = 0.8;
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
        const pointerDistance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
        if (pointerDistance < 210) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(8, 127, 91, ${(1 - pointerDistance / 210) * 0.25})`;
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.fillStyle = point.r === 2 ? 'rgba(8, 127, 91, .5)' : 'rgba(22, 119, 255, .3)';
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', () => (pointer = { x: -1000, y: -1000 }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onPointerMove);
    };
  }, []);
  return <canvas ref={canvasRef} className="data-network" aria-hidden="true" />;
}

const features = [
  {
    icon: Database,
    title: 'Human-in-the-Loop Schema Wizard',
    label: 'SCHEMA CONTROL',
    copy: "AI shouldn't guess your business logic. Sequelo's visual Rule Builder lets analysts map table relationships, define Fact vs. Dimension tables, and lock in custom metric formulas before the chat even begins.",
    tone: 'blue',
  },
  {
    icon: ShieldCheck,
    title: 'Designed for Accuracy',
    label: 'DETERMINISTIC MATH',
    copy: 'LLMs generate queries, not numerical results. Sequelo delegates calculations to DuckDB, allowing analytical operations to be performed by a database engine rather than relying on the language model to perform arithmetic.An evaluation loop provides execution feedback and supports limited SQL revision when errors occur.',
    tone: 'green',
  },
  {
    icon: BrainCircuit,
    title: 'Business Rule Extraction',
    label: 'SUPERVISION LAYER',
    copy: 'A chat that actually learns. The supervisor agent can identify business definitions and metric rules expressed in natural language. This provides a foundation for incorporating domain-specific business context into analytical queries.',
    tone: 'violet',
  },
  {
    icon: LockKeyhole,
    title: 'SQL Validation',
    label: 'AST VALIDATION',
    copy: 'Built for trust. Sequelo uses SQLGlot to parse and validate AI-generated SQL before executing analytical queries through DuckDB. This adds a structured validation step between natural-language query generation and database execution.',
    tone: 'cyan',
  }
];

const stack = [
  { icon: Atom, name: 'React & Vite' },         
  { icon: Zap, name: 'FastAPI' },               
  { icon: Share2, name: 'LangGraph' },          
  { icon: Database, name: 'DuckDB' },           
  { icon: Server, name: 'NeonDb pgvector' },    
  { icon: Flame, name: 'Backblaze B2' }         
];

function Reveal({ children, className = '' }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.7, ease }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="landing-page">
      <section className="hero">
        <DataNetwork />
        <div className="hero-grid" />
        <nav className="nav shell" aria-label="Main navigation">
          <a href="#" className="brand-link"><Logo /></a>
          <div className="nav-links">
            <a href="#architecture">Architecture</a>
            <a href={GITHUB_LINK} target="_blank" rel="noreferrer"><GitHubIcon size={16} /> GitHub</a>
            <Link to="/login" className="sign-in">Sign in</Link>
          </div>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
          {menuOpen && (
            <motion.div className="mobile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <a href="#architecture" onClick={() => setMenuOpen(false)}>Architecture</a>
              <a href={GITHUB_LINK} target="_blank" rel="noreferrer">GitHub</a>
              <Link to="/login">Sign in</Link>
            </motion.div>
          )}
        </nav>
        <div className="hero-content shell">
          <motion.div
            className="eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Autonomous Analytics for Data Professionals
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease }}
          >
            Stop Waiting on IT.<br />
            <span>Chat with Your Data Instantly.</span>
          </motion.h1>
          <motion.p
            className="hero-copy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.28, ease }}
          >
            Sequelo is an AI-assisted analytics prototype that transforms natural-language questions about CSV datasets into DuckDB queries. Built with LangGraph and SQLGlot, it explores how AI can make data analysis more accessible through automated query generation and validation.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease }}
          >
            <Link to="/login" className="button primary">Explore Live Demo <ArrowRight size={17} /></Link>
            <a href="#architecture" className="button secondary">View Architecture</a>
          </motion.div>
        </div>
      </section>
      
      <section className="section problem">
        <div className="shell">
          <Reveal>
            <div className="section-kicker">WHY SEQUELO</div>
            <h2>Traditional BI is <span>broken.</span></h2>
            <p className="section-intro">Your team deserves answers in minutes, not another infrastructure project.</p>
          </Reveal>
          <div className="comparison">
            <Reveal className="comparison-card old">
              <div className="comparison-icon"><Database size={22} /></div>
              <div className="status muted">THE OLD WAY</div>
              <h3>The IT Bottleneck</h3>
              <p>Weeks of security audits, writing complex ETL pipelines, and fighting for database read-access just to answer simple business questions.</p>
              <div className="bottleneck-flow">
                <span>REQUEST</span><i /><span>IT REVIEW</span><i /><span>ETL</span><i /><span>ANSWER</span>
              </div>
              <div className="time-label">Average time to insight: <strong>2-6 weeks</strong></div>
            </Reveal>
            <Reveal className="comparison-card new">
              <div className="comparison-icon"><Zap size={22} /></div>
              <div className="status"><i /> THE SEQUELO WAY</div>
              <h3>A Simpler Approach to Data Analysis</h3>
              <p>Analyze CSV datasets without configuring an external SQL database. Sequelo uses DuckDB to execute analytical queries against your data through an AI-powered natural-language interface.</p>
              <div className="benefits">
                {/* Bumped Checkmark sizes from 15 to 18 so they match the newly larger text */}
                <span><Check size={18} /> No database credentials</span>
                <span><Check size={18} /> Stateless compute</span>
                <span><Check size={18} /> Instant answers</span>
              </div>
              <div className="time-label">Average time to insight: <strong>&lt; 5 minutes</strong></div>
            </Reveal>
          </div>
        </div>
      </section>
      
      <section className="section features">
        <div className="shell">
          <Reveal className="section-heading-row">
            <div>
              <div className="section-kicker">CORE CAPABILITIES</div>
              <h2>Transparent <span>Query Execution.</span></h2>
            </div>
            <p>AI-native analytics with deterministic guardrails at every layer.</p>
          </Reveal>
          <div className="feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Reveal className={`feature-card ${feature.tone}`} key={feature.title}>
                  <div className="feature-top">
                    <div className="feature-icon"><Icon size={24} /></div>
                  </div>
                  <div className="feature-label">{feature.label}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
      
      <section className="section engine" id="architecture">
        <div className="shell engine-heading">
  <Reveal>
    <div className="section-kicker">THE ENGINE ROOM</div>
    <h2>Powered by <span>an AI-driven architecture.</span></h2>
    <p className="section-intro">
      Sequelo combines a modern frontend, an AI orchestration pipeline,
      and DuckDB to transform natural-language questions into analytical
      queries and clear, data-driven results.
    </p>
  </Reveal>
</div>
        <div className="marquee">
          <div className="marquee-track">
            {[...stack, ...stack].map((tech, index) => {
              const Icon = tech.icon;
              return (
                <div className="tech-tag" key={`${tech.name}-${index}`}>
                  <span><Icon size={18} strokeWidth={2.5} /></span>{tech.name}<i />
                </div>
              );
            })}
          </div>
        </div>

        <div className="shell architecture-strip">
          <div><small>QUERY LAYER</small><strong>Natural Language</strong></div><ArrowRight />
          <div><small>ORCHESTRATION</small><strong>LangGraph Agents</strong></div><ArrowRight />
          <div><small>COMPUTE</small><strong>DuckDB Engine</strong></div><ArrowRight />
          <div><small>VALIDATION</small><strong>AST Firewall</strong></div>
        </div>
      </section>
      
      <section className="section process">
        <div className="shell">
          <Reveal className="process-heading">
            <div className="section-kicker">HOW IT WORKS</div>
            <h2>From raw files to <span>real answers.</span></h2>
          </Reveal>
          <div className="steps">
            <div className="process-line"><i /></div>
            {[
              { icon: UploadCloud, n: '01', title: 'Upload.', text: 'Drag and drop your raw exports. The engine peeks at the metadata instantly.' },
              { icon: Code2, n: '02', title: 'Verify.', text: 'Use plain-English dropdowns to align relationships and formulas.' },
              { icon: Sparkles, n: '03', title: 'Ask.', text: 'Talk to your data. Sequelo generates the SQL, DuckDB crunches the rows, and you get the exact answer.' },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <Reveal className="step" key={step.n}>
                  <div className="step-node"><Icon size={24} /></div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
      
      <footer id="get-started">
        <div className="shell">
          <Reveal className="cta-banner">
            <div className="cta-copy">
              <div className="section-kicker light">ESCAPE THE BOTTLENECK</div>
              <h2>Ready to start<br /><span>building?</span></h2>
              <p>Deploy the Sequelo architecture locally or test the live MVP today.</p>
            </div>
            <Link className="button cta-button" to="/login">Get Started for Free <ArrowRight size={18} /></Link>
          </Reveal>
          <div className="footer-row">
            <Logo />
            <div className="footer-links">
              <a href={GITHUB_LINK} target="_blank" rel="noreferrer"><GitHubIcon size={16} /> GitHub</a>
              <a href={LINKEDIN_LINK} target="_blank" rel="noreferrer">LinkedIn</a>
            </div>
            <div className="copyright">© {new Date().getFullYear()} SEQUELO</div>
          </div>
        </div>
      </footer>
    </main>
  );
}