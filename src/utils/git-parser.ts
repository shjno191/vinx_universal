export interface GraphCommit {
  hash: string;
  parents: string[];
  msg: string;
  author: string;
  initials: string;
  date: string;
  decorHtml: string;
  lane: number;
  color: string;
}

export interface GraphPath {
  d: string;
  color: string;
}

const ROW_H = 36;
const LANE_W = 16;
const PALETTE = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#38bdf8', '#c084fc', '#f87171'];

/**
 * Parses raw git log output into a graph structure for rendering.
 * @param raw Raw string output from `git log --format=%h|%p|%s|%an|%cr|%D`
 */
export function parseGraph(raw: string): { commits: GraphCommit[], paths: GraphPath[], maxLanes: number } {
  const rawLines = raw.split('\n').filter(l => l.trim());
  let colorCounter = 0;
  const getColor = () => PALETTE[colorCounter++ % PALETTE.length];

  const activeBranches: Array<{ hash: string, color: string } | null> = [];
  const commits: GraphCommit[] = [];
  const paths: GraphPath[] = [];
  let maxLanes = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const parts = rawLines[i].split('|');
    const hash = parts[0];
    const parents = parts[1] ? parts[1].split(' ') : [];
    const msg = parts[2] || '';
    const author = parts[3] || 'Unknown';
    const date = parts[4] || '';
    const decor = parts[5] || '';

    let laneIdx = activeBranches.findIndex(b => b?.hash === hash);
    if (laneIdx === -1) laneIdx = activeBranches.findIndex(b => b === null);
    if (laneIdx === -1) laneIdx = activeBranches.length;

    maxLanes = Math.max(maxLanes, activeBranches.length, laneIdx + 1);

    const nodeColor = activeBranches[laneIdx]?.color || getColor();

    const ty = i * ROW_H;
    const my = i * ROW_H + ROW_H / 2;
    const nx = laneIdx * LANE_W + LANE_W / 2;

    activeBranches.forEach((b, L) => {
      if (!b) return;
      const tx = L * LANE_W + LANE_W / 2;
      if (b.hash === hash) {
        paths.push({ d: `M ${tx} ${ty} C ${tx} ${(ty + my) / 2}, ${nx} ${(ty + my) / 2}, ${nx} ${my}`, color: b.color });
      } else {
        paths.push({ d: `M ${tx} ${ty} L ${tx} ${ty + ROW_H}`, color: b.color });
      }
    });

    const nextBranches = [...activeBranches];
    nextBranches.forEach((b, L) => {
      if (b && b.hash === hash && L !== laneIdx) nextBranches[L] = null;
    });

    const by = (i + 1) * ROW_H;

    if (parents.length > 0) {
      nextBranches[laneIdx] = { hash: parents[0], color: nodeColor };
      const bx = laneIdx * LANE_W + LANE_W / 2;
      paths.push({ d: `M ${nx} ${my} L ${bx} ${by}`, color: nodeColor });

      for (let p = 1; p < parents.length; p++) {
        const parentHash = parents[p];
        let pLane = nextBranches.findIndex(b => b === null);
        if (pLane === -1) pLane = nextBranches.length;

        const pColor = getColor();
        nextBranches[pLane] = { hash: parentHash, color: pColor };
        const pbx = pLane * LANE_W + LANE_W / 2;
        paths.push({ d: `M ${nx} ${my} C ${nx} ${(my + by) / 2}, ${pbx} ${(my + by) / 2}, ${pbx} ${by}`, color: pColor });
      }
    } else {
      nextBranches[laneIdx] = null;
    }

    while (nextBranches.length > 0 && nextBranches[nextBranches.length - 1] === null) {
      nextBranches.pop();
    }

    activeBranches.length = 0;
    activeBranches.push(...nextBranches);
    maxLanes = Math.max(maxLanes, activeBranches.length);

    // Decor parsing logic (Needs to be moved here to separate logic from UI)
    let decorHtml = '';
    if (decor) {
      const cleanDecor = decor.replace(/[()]/g, '');
      const bits = cleanDecor.split(', ');
      decorHtml = bits.map(bit => {
        let cls = 'd-pill';
        if (bit.includes('HEAD ->')) { cls += ' head'; bit = bit.replace('HEAD -> ', ''); }
        else if (bit.includes('origin/')) { cls += ' remote'; }
        else if (bit.includes('tag: ')) { cls += ' tag'; bit = bit.replace('tag: ', ''); }
        // We handle simple string here, sanitization should happen before rendering
        return `<span class="${cls}">${bit}</span>`;
      }).join('');
    }

    const names = author.trim().split(/\s+/);
    const initials = names.length > 1
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : (names[0].substring(0, 2).toUpperCase() || 'U');

    commits.push({ hash, parents, msg, author, initials, date, decorHtml, lane: laneIdx, color: nodeColor });
  }

  return { commits, paths, maxLanes };
}
