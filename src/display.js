// Live link between the cashier screen (/pos) and the customer-facing screen (/display).
// Both windows must be open in the same browser; messages travel through BroadcastChannel.
const CH = 'cn-pos-display';
const LAST = CH + '-last';

export function sendDisplay(data) {
  try {
    const c = new BroadcastChannel(CH);
    c.postMessage(data);
    c.close();
    localStorage.setItem(LAST, JSON.stringify(data));
  } catch { /* unsupported browser – display just stays idle */ }
}

export function listenDisplay(fn) {
  let c;
  try {
    c = new BroadcastChannel(CH);
    c.onmessage = (e) => fn(e.data);
    const last = localStorage.getItem(LAST);
    if (last) { const d = JSON.parse(last); if (d.stage === 'cart') fn(d); }
  } catch { /* ignore */ }
  return () => c && c.close();
}

export const openDisplay = () => window.open(location.href.split('#')[0] + '#/display', 'cn-customer-display', 'width=1100,height=700');
