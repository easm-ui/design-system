// The README's pictures, drawn with the real packages. `node .github/readme/build.mjs` renders each scene
// to a PNG beside this file. Every figure and name here is invented sample data.
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import * as UI from '../../packages/ui/src/index';
import { Icon } from '../../packages/icons/src/index';
import { EasmLogo } from '../../packages/brand/src/index';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
  id: label, label, values: { total: [182, 214, 239, 226, 268, 141, 118][i], ai: [151, 183, 207, 199, 236, 129, 109][i] },
}));
const series = [{ id: 'total', label: 'Conversations' }, { id: 'ai', label: 'Answered by the assistant', tone: 'teal' as const }];

const nav = [
  { id: 'home', label: 'Home', href: '#', icon: 'home', group: 'Overview' },
  { id: 'inbox', label: 'Inbox', href: '#', icon: 'inbox', badge: 12, group: 'Work' },
  { id: 'work', label: 'Work', href: '#', icon: 'clipboard-task', group: 'Work' },
  { id: 'contacts', label: 'Contacts', href: '#', icon: 'contact-card', group: 'Records' },
  { id: 'pipeline', label: 'Pipeline', href: '#', icon: 'funnel', group: 'Records' },
  { id: 'analytics', label: 'Analytics', href: '#', icon: 'analytics', group: 'Insights' },
  { id: 'settings', label: 'Settings', href: '#', icon: 'settings', group: 'Configure' },
] as const;

const people = [
  { id: '1', name: 'Hira Baig', channel: 'Website chat', topic: 'Fee instalments', status: 'processing' },
  { id: '2', name: 'Omar Siddiqui', channel: 'WhatsApp', topic: 'BS Computer Science', status: 'done' },
  { id: '3', name: 'Zara Ahmed', channel: 'Phone', topic: 'Hostel rooms', status: 'blocked' },
  { id: '4', name: 'Bilal Raza', channel: 'Website chat', topic: 'Merit list', status: 'done' },
];

function Dashboard() {
  return (
    <div className="scene dashboard">
      <aside className="side"><UI.Sidebar label="Main" activeId="inbox" items={nav as never} brand={<EasmLogo product="Support" height={22} />} /></aside>
      <main>
        <header className="head">
          <div>
            <h1>Support</h1>
            <p>Every conversation across the website, WhatsApp and the phone line.</p>
          </div>
          <div className="row">
            <UI.Button variant="secondary" leadingIcon="download">Export</UI.Button>
            <UI.Button leadingIcon="add">New campaign</UI.Button>
          </div>
        </header>
        <div className="stats">
          <UI.StatCard label="Conversations" value={1388} icon="chat" tone="violet" />
          <UI.StatCard label="Answered by the assistant" value="87%" icon="sparkle" tone="teal" />
          <UI.StatCard label="Median first reply" value="42 s" icon="clock" tone="amber" />
          <UI.StatCard label="Qualified leads" value={214} icon="target" tone="coral" />
        </div>
        <div className="split">
          <UI.SeriesChart title="Conversations this week" description="All channels, by day" series={series} data={days} kind="bar" />
          <UI.BarList label="Top questions" tone="auto" display="both" items={[
            { id: 'a', label: 'Admissions', value: 412 }, { id: 'f', label: 'Fees', value: 318 },
            { id: 'p', label: 'Programmes', value: 247 }, { id: 'h', label: 'Hostels', value: 96 }, { id: 't', label: 'Transport', value: 61 },
          ]} />
        </div>
        <UI.DataTable label="Latest conversations" title="Latest conversations" rows={people} rowKey={(r) => r.id} columns={[
          { id: 'name', label: 'Person', value: (r) => <UI.UserChip name={r.name} /> },
          { id: 'channel', label: 'Channel', value: (r) => r.channel },
          { id: 'topic', label: 'Asked about', value: (r) => r.topic },
          { id: 'status', label: 'Status', value: (r) => <UI.StatusChip status={r.status as never} size="sm" /> },
        ]} />
      </main>
    </div>
  );
}

function Hero() {
  return (
    <div className="scene hero">
      <div className="copy">
        <EasmLogo height={34} />
        <h1>The design system behind EASM One</h1>
        <p>React components, 680 icons with directed motion, one token source and the EASM brand kit. Accessible, right-to-left ready, built for real products.</p>
        <code>npm install @easm-ui/ui</code>
      </div>
      <div className="collage">
        <div className="thread">
          <UI.Message author="contact" name="Hira Baig" time="10:41"><p>Can I pay the fee in instalments?</p></UI.Message>
          <UI.Message author="assistant" name="Assistant" time="10:41"><p>Yes. Undergraduate fees can be paid in two instalments each semester.</p></UI.Message>
        </div>
        <div className="pair">
          <UI.StatCard label="Answered by the assistant" value="87%" icon="sparkle" tone="teal" />
          <UI.StatCard label="Qualified leads" value={214} icon="target" tone="coral" />
        </div>
        <div className="chips">
          <UI.StatusChip status="processing" /><UI.StatusChip status="done" /><UI.Presence state="online" />
          <UI.Button leadingIcon="send">Send reply</UI.Button>
        </div>
      </div>
    </div>
  );
}

const pick = ['inbox', 'chat', 'call', 'mail', 'analytics', 'calendar', 'clock', 'contact-card', 'funnel', 'target', 'sparkle', 'settings',
  'search', 'filter', 'download', 'upload', 'send', 'attach', 'lock-closed', 'shield-lock', 'globe', 'home', 'clipboard-task', 'fee-voucher',
  'library', 'graduation-cap', 'building-bank', 'bus', 'flask', 'trophy', 'lightbulb', 'briefcase', 'microphone-off', 'headset', 'document', 'folder-open',
  'notify-bell', 'user', 'users', 'heart', 'rating-star', 'bookmark', 'edit', 'delete', 'copy', 'link', 'refresh', 'check-circle'];

function Icons() {
  return (
    <div className="scene icons">
      {pick.map((name) => (
        <div className="cell" key={name}><Icon name={name as never} size={28} /><span>{name}</span></div>
      ))}
    </div>
  );
}

const products = ['Support', 'Knowledge', 'Marketing', 'Automation', 'Forms'];
function Brand() {
  return (
    <div className="scene brand">
      <div className="main"><EasmLogo height={64} /><EasmLogo height={64} theme="dark" /></div>
      <div className="products">{products.map((p) => <EasmLogo key={p} product={p} height={26} />)}</div>
    </div>
  );
}

function Controls() {
  return (
    <div className="scene controls">
      <section>
        <h2>Actions</h2>
        <div className="row">
          <UI.Button>Publish</UI.Button><UI.Button variant="secondary" leadingIcon="calendar">Schedule</UI.Button>
          <UI.Button variant="subtle">Preview</UI.Button><UI.Button variant="destructive" leadingIcon="delete">Delete</UI.Button>
        </div>
        <UI.SegmentedControl label="Range" defaultValue="w" options={[{ id: 'd', label: 'Today' }, { id: 'w', label: 'This week' }, { id: 'm', label: 'Month' }] as never} />
      </section>
      <section>
        <h2>Inputs</h2>
        <UI.TextField label="Full name" defaultValue="Zara Ahmed" />
        <UI.TextField label="Email" defaultValue="zara@uni.example.edu" />
        <div className="row"><UI.Switch label="Reply automatically" defaultChecked /></div>
      </section>
      <section>
        <h2>Feedback</h2>
        <UI.Alert tone="success" title="Campaign published" description="Calls start at 10:00 tomorrow." />
        <div className="row">
          <UI.StatusChip status="processing" /><UI.StatusChip status="done" /><UI.StatusChip status="failed" /><UI.StatusChip status="blocked" />
        </div>
      </section>
      <section>
        <h2>Data</h2>
        <UI.DonutChart label="Channels" segments={[
          { id: 'w', label: 'Website', value: 612, tone: 'violet' }, { id: 'a', label: 'WhatsApp', value: 488, tone: 'teal' }, { id: 'p', label: 'Phone', value: 288, tone: 'amber' },
        ]} />
      </section>
    </div>
  );
}

const scenes: Record<string, () => ReactNode> = { hero: Hero, dashboard: Dashboard, icons: Icons, brand: Brand, controls: Controls };
const Scene = scenes[location.hash.slice(1)] ?? Hero;
createRoot(document.getElementById('root')!).render(<UI.TooltipProvider><Scene /></UI.TooltipProvider>);
