/* Math Quest curriculum: procedural problem generators + Socratic hint ladders.
 *
 * Every generator returns:
 *   { prompt:  HTML string shown to the player,
 *     answer:  {kind:'int',v} | {kind:'decimal',v,tol} | {kind:'fraction',n,d} | {kind:'text',accept:[...]} ,
 *     hints:   [{t:'title', html:'...'}]  -- socratic: teach the METHOD with a
 *               PARALLEL example (different numbers), ask guiding questions,
 *               NEVER compute the player's specific numbers. }
 *
 * gen(rnd, heat): rnd() -> [0,1); heat in [0,1] scales difficulty inside a tier.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
function fracHTML(n, d) {
  return `<span class="frac"><span class="fnum">${n}</span><span class="fden">${d}</span></span>`;
}
function mixedHTML(n, d) {
  const w = Math.floor(n / d), r = n % d;
  if (w === 0) return fracHTML(r, d);
  if (r === 0) return `${w}`;
  return `${w} ${fracHTML(r, d)}`;
}
// reduce a fraction, keep sign on numerator
function red(n, d) { const g = gcd(n, d); return [n / g, d / g]; }

/* ------------------------------ FRACTIONS ------------------------------ */
const fractionsT1 = {
  name: 'Simplifying & comparing',
  gen(rnd, heat) {
    if (rnd() < 0.55) {
      // simplify a reducible fraction
      const d = pick(rnd, [4, 6, 8, 9, 10, 12]);
      const k = ri(rnd, 2, 4);
      let n = ri(rnd, 1, d - 1) * k, dd = d * k;
      [n, dd] = red(n, dd);
      // re-expand so it's not already simplified
      const kk = ri(rnd, 2, 5);
      const N = n * kk, D = dd * kk;
      const [an, ad] = red(N, D);
      return {
        prompt: `Simplify ${fracHTML(N, D)}`,
        answer: { kind: 'fraction', n: an, d: ad },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Simplifying means dividing the <b>top and bottom by the same number</b> until nothing divides both anymore.</p><p>Example with <i>different</i> numbers: simplify ${fracHTML(4, 6)}. Both 4 and 6 are divisible by 2, so ${fracHTML(4, 6)} = ${fracHTML(2, 3)}. Nothing divides both 2 and 3, so we're done.</p><p><b>Your turn:</b> what number divides into both your top and bottom?</p>` },
          { t: 'Hint 2 — find the divisor', html: `<p>List numbers that divide the top evenly: 1, 2, 3… Do the same for the bottom. Which is the <b>biggest</b> number on both lists?</p><p>Divide your top and bottom by that number. What do you get?</p>` },
          { t: 'Hint 3 — check it', html: `<p>After dividing, look at your new fraction: does any number (other than 1) still divide <b>both</b> the top and bottom? If yes, divide again. If no, that's your simplified answer.</p>` },
        ],
      };
    }
    // equivalent fractions: find the missing numerator (typed, not a 50/50 pick)
    const d = pick(rnd, [3, 4, 5, 6, 8]);
    const n = ri(rnd, 1, d - 1);
    const k = ri(rnd, 2, 5);
    return {
      prompt: `${fracHTML(n, d)} = ${fracHTML('?', d * k)} — what is ?`,
      answer: { kind: 'int', v: n * k },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Equivalent fractions are made by multiplying the top and bottom by the <b>same</b> number.</p><p>Example with <i>different</i> numbers: ${fracHTML(2, 5)} = ${fracHTML('?', 15)}. The bottom went 5 → 15, that’s × 3 — so the top goes 2 × 3 = 6. Answer: 6.</p><p><b>Your turn:</b> your bottom went ${d} → ${d * k}. What was it multiplied by? Do the same to your top.</p>` },
        { t: 'Hint 2 — check it', html: `<p>Multiply your bottom by your multiplier — do you get ${d * k}? Now multiply your top by the same multiplier. Simplify your result if you can, then type just the number.</p>` },
      ],
    };
  },
};

const fractionsT2 = {
  name: 'Add & subtract, same denominator',
  gen(rnd, heat) {
    const d = ri(rnd, 5, 12);
    const add = rnd() < 0.6;
    let a = ri(rnd, 1, d - 1), b = ri(rnd, 1, d - 1);
    if (!add && b > a) [a, b] = [b, a];
    if (add && a + b >= 2 * d) { a = Math.max(1, a - 2); b = Math.max(1, b - 2); }
    const n = add ? a + b : a - b;
    const [an, ad] = red(n, d);
    const op = add ? '+' : '−';
    return {
      prompt: `${fracHTML(a, d)} ${op} ${fracHTML(b, d)} = ?`,
      answer: { kind: 'fraction', n: an, d: ad },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Same denominator? Easy: <b>add or subtract the tops, keep the bottom the same</b>.</p><p>Example with <i>different</i> numbers: ${fracHTML(2, 9)} + ${fracHTML(5, 9)} — the bottoms match, so just do 2 + 5 = 7 on top: ${fracHTML(7, 9)}.</p><p><b>Your turn:</b> your bottoms already match. What happens on top?</p>` },
        { t: 'Hint 2 — one step at a time', html: `<p>Cover up the denominators with your thumb. Now it's just ${a} ${op} ${b} = ? Then put the denominator ${d} back under your answer — and simplify if you can.</p>` },
      ],
    };
  },
};

const fractionsT3 = {
  name: 'Add & subtract, different denominators',
  gen(rnd, heat) {
    const add = rnd() < 0.6;
    let d1 = ri(rnd, 2, heat > 0.5 ? 12 : 8), d2 = ri(rnd, 2, heat > 0.5 ? 12 : 8);
    if (d1 === d2) d2 = d2 === 12 ? 10 : d2 + 1;
    const a = ri(rnd, 1, d1 - 1), b = ri(rnd, 1, d2 - 1);
    const L = lcm(d1, d2);
    let n = add ? a * (L / d1) + b * (L / d2) : a * (L / d1) - b * (L / d2);
    if (!add && n <= 0) { // ensure positive result: swap roles
      return fractionsT3.gen(rnd, heat);
    }
    const [an, ad] = red(n, L);
    const op = add ? '+' : '−';
    return {
      prompt: `${fracHTML(a, d1)} ${op} ${fracHTML(b, d2)} = ?`,
      answer: { kind: 'fraction', n: an, d: ad },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>You can only add/subtract fractions with the <b>same denominator</b>. So first rewrite both with a common denominator.</p><p>Example with <i>different</i> numbers: ${fracHTML(1, 3)} + ${fracHTML(1, 4)}. A number both 3 and 4 divide into is 12. Rewrite: ${fracHTML(1, 3)} = ${fracHTML(4, 12)} and ${fracHTML(1, 4)} = ${fracHTML(3, 12)}. Now ${fracHTML(4, 12)} + ${fracHTML(3, 12)} = ${fracHTML(7, 12)}.</p><p><b>Your turn:</b> what’s a number both ${d1} and ${d2} divide into evenly?</p>` },
        { t: 'Hint 2 — rewrite each fraction', html: `<p>Found your common denominator? Good. Now ask: “${d1} × what = my new denominator?” Multiply the top by that same “what” — that rewrites your first fraction. Do the same for the second one.</p><p>Now the bottoms match, so just ${add ? 'add' : 'subtract'} the tops. What do you get?</p>` },
        { t: 'Hint 3 — finish clean', html: `<p>After ${add ? 'adding' : 'subtracting'} the tops, check: can your answer be simplified? If a number divides both the top and bottom, divide it out.</p>` },
      ],
    };
  },
};

/* ------------------------------ DECIMALS ------------------------------ */
const decimalsT1 = {
  name: 'Place value, comparing, adding',
  gen(rnd, heat) {
    const kind = ri(rnd, 0, 2);
    if (kind === 0) {
      // round to the nearest tenth (typed decimal, not a 50/50 pick)
      const val = ri(rnd, 0, 20) + ri(rnd, 0, 9) / 10 + ri(rnd, 0, 9) / 100;
      const rounded = Math.round(val * 10) / 10;
      return {
        prompt: `Round ${val.toFixed(2)} to the nearest tenth.`,
        answer: { kind: 'decimal', v: +rounded.toFixed(1), tol: 0.001 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>To round to the nearest tenth, peek at the <b>hundredths</b> digit: 5 or more rounds the tenths <b>up</b>, 4 or less leaves it alone.</p><p>Example: 3.47 — hundredths digit is 7 (≥ 5), so the 4 rounds up: 3.5.</p><p><b>Your turn:</b> in ${val.toFixed(2)}, what’s the hundredths digit? Does your tenths digit round up or stay?</p>` },
          { t: 'Hint 2 — the carry', html: `<p>Careful when the tenths digit is 9 and rounds up: 4.96 → 5.0 (the ones digit carries). Write your rounded answer with one decimal place.</p>` },
        ],
      };
    }
    // add or subtract decimals
    const add = rnd() < 0.6;
    const a = ri(rnd, 10, 999) / 100, b = ri(rnd, 10, 999) / 100;
    const v = add ? a + b : Math.abs(a - b);
    const val = +v.toFixed(2);
    return {
      prompt: `${a} ${add ? '+' : '−'} ${b} = ?`,
      answer: { kind: 'decimal', v: val, tol: 0.005 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Line up the decimal points</b> — that lines up ones with ones, tenths with tenths. Then add or subtract exactly like whole numbers, and drop the decimal point straight down into your answer.</p><p>Example: 2.3 + 1.45. Line them up:<br><span class="mono">&nbsp;&nbsp;2.30<br>+ 1.45<br>------<br>&nbsp;&nbsp;3.75</span></p><p><b>Your turn:</b> rewrite your problem with the decimal points lined up (add a trailing zero if one number is shorter). What do you get?</p>` },
        { t: 'Hint 2 — estimate first', html: `<p>Quick sanity check: round each number and ${add ? 'add' : 'subtract'} roughly. Your exact answer should be close to that estimate — if it’s way off, the decimal point probably slipped.</p>` },
      ],
    };
  },
};

const decimalsT2 = {
  name: 'Multiplying & converting',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      // multiply decimals
      const a = ri(rnd, 2, 9) / 10, b = ri(rnd, 2, 9);
      const v = +(a * b).toFixed(2);
      return {
        prompt: `${a} × ${b} = ?`,
        answer: { kind: 'decimal', v, tol: 0.005 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Multiply <b>as if the decimals weren’t there</b>, then put the decimal point back: your answer needs as many decimal places as both factors <b>combined</b>.</p><p>Example: 0.4 × 0.3. Ignore decimals: 4 × 3 = 12. The factors have 1 + 1 = 2 decimal places, so 12 becomes 0.12.</p><p><b>Your turn:</b> multiply your numbers ignoring decimals. Then count: how many decimal places do your two factors have in total?</p>` },
          { t: 'Hint 2 — place the point', html: `<p>You have your whole-number product. Now count that many places from the <b>right</b> and drop the point in. Add a leading zero if you run out of digits (like 12 → 0.12).</p>` },
        ],
      };
    }
    // fraction <-> decimal
    const d = pick(rnd, [2, 4, 5, 8, 10]);
    const n = ri(rnd, 1, d - 1);
    const v = +(n / d).toFixed(3);
    return {
      prompt: `Write ${fracHTML(n, d)} as a decimal.`,
      answer: { kind: 'decimal', v, tol: 0.002 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>A fraction bar means <b>divide</b>: top ÷ bottom.</p><p>Example: ${fracHTML(3, 4)} means 3 ÷ 4 = 0.75.</p><p><b>Your turn:</b> divide your top number by your bottom number. What do you get?</p>` },
        { t: 'Hint 2 — think in money', html: `<p>It can help to think of ${d === 4 ? 'quarters' : d === 2 ? 'halves' : d === 8 ? 'eighths' : 'pieces'}: each ${fracHTML(1, d)} is worth ${(1 / d).toFixed(3)} as a decimal. You have ${n} of them — so multiply.</p>` },
      ],
    };
  },
};

const decimalsT3 = {
  name: 'Dividing decimals',
  gen(rnd, heat) {
    const a = ri(rnd, 12, 96) / 10, b = ri(rnd, 2, 9);
    const v = +(a / b).toFixed(2);
    return {
      prompt: `${a} ÷ ${b} = ? <span class="muted">(round to 2 decimal places)</span>`,
      answer: { kind: 'decimal', v, tol: 0.006 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>When dividing <b>by a whole number</b>, just divide normally and put the decimal point <b>straight up</b> into your answer, right above where it sits in the dividend.</p><p>Example: 4.8 ÷ 4. Divide 48 ÷ 4 = 12, then the point goes straight up: 1.2.</p><p><b>Your turn:</b> ignore your decimal point and divide. Then float the point straight up into the answer. Where does it land?</p>` },
        { t: 'Hint 2 — check by multiplying', html: `<p>Division undoes multiplication: your answer × ${b} should give back about ${a}. Try it with your answer — close? If not, recheck where the point landed.</p>` },
      ],
    };
  },
};

/* -------------------------- ORDER OF OPERATIONS -------------------------- */
function oooGen(rnd, heat, tier) {
  // builds an expression tree; returns {expr HTML, value}
  const R = (a, b) => ri(rnd, a, b);
  if (tier === 1) {
    if (rnd() < 0.5) { const a = R(2, 12), b = R(2, 9), c = R(2, 9); return { h: `${a} + ${b} × ${c}`, v: a + b * c }; }
    const a = R(3, 12), b = R(1, a - 1 > 1 ? a - 1 : 1), c = R(2, 9);
    return { h: `(${a} − ${b}) × ${c}`, v: (a - b) * c };
  }
  if (tier === 2) {
    const style = ri(rnd, 0, 2);
    if (style === 0) { const a = R(2, 9), b = R(2, 9), c = R(1, 9), d = R(2, 9); return { h: `${a} + ${b} × (${c} + ${d})`, v: a + b * (c + d) }; }
    if (style === 1) { const a = R(10, 30), b = R(2, 12), c = R(2, 6), d = R(1, 9); return { h: `${a} − ${b} ÷ ${c} + ${d}`, v: a - b / c + d }; }
    const a = R(3, 9), b = R(2, 9), c = R(2, 5), e = R(1, 9); return { h: `(${a} + ${b}) × ${c} − ${e}`, v: (a + b) * c - e };
  }
  const style = ri(rnd, 0, 2);
  if (style === 0) { const a = R(2, 5), b = R(2, 6), c = R(2, 4); return { h: `${a}<sup>2</sup> + ${b} × ${c}`, v: a * a + b * c }; }
  if (style === 1) { const a = R(2, 6), b = R(1, 4), e = R(5, 20); return { h: `(${a} + ${b})<sup>2</sup> − ${e}`, v: (a + b) * (a + b) - e }; }
  const a = R(2, 4); return { h: `100 ÷ (2 × 5) + ${a}<sup>3</sup>`, v: 100 / 10 + a * a * a };
}

const OOO_HINTS = [
  { t: 'Hint 1 — the order', html: `<p>Math has a pecking order: <b>1) Parentheses</b> first, <b>2) Exponents</b>, <b>3) Multiply &amp; Divide</b> (left to right), <b>4) Add &amp; Subtract</b> (left to right).</p><p>Example: 3 + 4 × 2. Multiplication outranks addition, so it’s 3 + 8 = 11 — <i>not</i> 14.</p><p><b>Your turn:</b> look at your expression. Which operation outranks the others? Do that one first.</p>` },
  { t: 'Hint 2 — shrink it step by step', html: `<p>Do <b>one</b> operation — the highest-ranking one — and rewrite the whole expression with that part replaced by its answer. Then look at the new, shorter expression and repeat.</p><p>Keep going until a single number is left. What’s your first step?</p>` },
  { t: 'Hint 3 — check the traps', html: `<p>Two classic traps: (1) going left-to-right and ignoring the order — multiplication/division always beat addition/subtraction; (2) forgetting that inside parentheses, the order rules still apply.</p><p>Re-scan your expression for the highest-ranking operation you haven’t done yet.</p>` },
];
const orderT1 = { name: 'Two operations', gen: (rnd, heat) => { const e = oooGen(rnd, heat, 1); return { prompt: `${e.h} = ?`, answer: { kind: 'int', v: e.v }, hints: OOO_HINTS }; } };
const orderT2 = { name: 'Parentheses & mixed', gen: (rnd, heat) => { const e = oooGen(rnd, heat, 2); const v = e.v; const isInt = Math.abs(v - Math.round(v)) < 1e-9; return { prompt: `${e.h} = ?`, answer: isInt ? { kind: 'int', v: Math.round(v) } : { kind: 'decimal', v: +v.toFixed(2), tol: 0.01 }, hints: OOO_HINTS }; } };
const orderT3 = { name: 'Exponents & nested', gen: (rnd, heat) => { const e = oooGen(rnd, heat, 3); return { prompt: `${e.h} = ?`, answer: { kind: 'int', v: e.v }, hints: OOO_HINTS }; } };

/* ------------------------------ NEGATIVES ------------------------------ */
const negativesT1 = {
  name: 'Adding & subtracting small',
  gen(rnd, heat) {
    const a = ri(rnd, -9, 9), b = ri(rnd, -9, 9);
    if (a === 0 || b === 0) return negativesT1.gen(rnd, heat);
    const add = rnd() < 0.5;
    const fmt = (n) => (n < 0 ? `(${n})` : `${n}`);
    const v = add ? a + b : a - b;
    return {
      prompt: `${a} ${add ? '+' : '−'} ${fmt(b)} = ?`,
      answer: { kind: 'int', v },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Think of a <b>number line</b>: adding moves right, subtracting moves left. A negative number just means “start left of zero.”</p><p>Example: −3 + 5. Start at −3, move 5 steps right: −2, −1, 0, 1, 2. Answer: 2.</p><p><b>Your turn:</b> where do you start on the number line, and which way (and how far) do you move?</p>` },
        { t: 'Hint 2 — two minuses?', html: `<p>Watch for double signs: <b>minus a negative</b> is the same as <b>plus</b> — 4 − (−3) is just 4 + 3. And <b>plus a negative</b> is the same as <b>minus</b> — 4 + (−3) is 4 − 3.</p><p>Does your problem have a double sign hiding in it?</p>` },
      ],
    };
  },
};

const negativesT2 = {
  name: 'Longer chains',
  gen(rnd, heat) {
    const a = ri(rnd, -15, 15), b = ri(rnd, -15, 15), c = ri(rnd, -12, 12);
    if (a === 0 || b === 0) return negativesT2.gen(rnd, heat);
    const op1 = rnd() < 0.5 ? '+' : '−', op2 = rnd() < 0.5 ? '+' : '−';
    const fmt = (n) => (n < 0 ? `(${n})` : `${n}`);
    const v = (op1 === '+' ? a + b : a - b) + (op2 === '+' ? c : -c);
    return {
      prompt: `${a} ${op1} ${fmt(b)} ${op2} ${fmt(c)} = ?`,
      answer: { kind: 'int', v },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Work <b>left to right, two numbers at a time</b>. Combine the first two into a single number, then bring in the third.</p><p>Example: −4 − 5 + 2. First −4 − 5 = −9. Then −9 + 2 = −7.</p><p><b>Your turn:</b> combine just your first two numbers. What single number do they make?</p>` },
        { t: 'Hint 2 — sign check', html: `<p>Before moving on, double-check the sign of your running total: is it positive, negative, or zero? Most mistakes here are sign mistakes, not arithmetic mistakes.</p>` },
      ],
    };
  },
};

const negativesT3 = {
  name: 'Multiplying & dividing',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, -9, 9) || 3, b = ri(rnd, -9, 9) || -4;
      return {
        prompt: `(${a}) × (${b}) = ?`,
        answer: { kind: 'int', v: a * b },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Multiply the numbers <b>ignoring signs</b> first. Then decide the sign: <b>same signs → positive</b>, <b>different signs → negative</b>.</p><p>Examples: (−3) × (−4) = +12 (same signs). (−3) × 4 = −12 (different signs).</p><p><b>Your turn:</b> are your two signs the same or different? What does that tell you about your answer’s sign?</p>` },
          { t: 'Hint 2 — count the negatives', html: `<p>Shortcut: count the negative signs. <b>Even</b> count → positive answer. <b>Odd</b> count → negative answer. How many negatives are in your problem?</p>` },
        ],
      };
    }
    if (style === 1) {
      const b = ri(rnd, -9, 9) || -3, q = ri(rnd, -9, 9) || 4, a = b * q;
      return {
        prompt: `${a} ÷ (${b}) = ?`,
        answer: { kind: 'int', v: q },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Division follows the <b>same sign rule</b> as multiplication: same signs → positive, different signs → negative.</p><p>Example: (−20) ÷ (−4): 20 ÷ 4 = 5, same signs → +5.</p><p><b>Your turn:</b> divide ignoring signs, then apply the sign rule. Same or different?</p>` },
        ],
      };
    }
    const a = ri(rnd, -4, -2);
    const e = 3;
    return {
      prompt: `(${a})<sup>${e}</sup> = ?`,
      answer: { kind: 'int', v: a * a * a },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>An exponent means <b>repeated multiplication</b>: (−2)<sup>3</sup> = (−2) × (−2) × (−2).</p><p>Multiply left to right and track the sign with the even/odd rule: (−2)×(−2) = +4, then +4 × (−2) = −8.</p><p><b>Your turn:</b> write your power out as repeated multiplication. What’s the sign of the final answer — even or odd number of negatives?</p>` },
      ],
    };
  },
};

/* ------------------------------ RATIOS ------------------------------ */
const ratiosT1 = {
  name: 'Simplifying & equivalent ratios',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9), k = ri(rnd, 2, 5);
      const A = a * k, B = b * k;
      return {
        prompt: `Simplify the ratio ${A} : ${B}`,
        answer: { kind: 'text', accept: [`${a}:${b}`, `${a} : ${b}`, `${a}/${b}`] },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>A ratio simplifies <b>exactly like a fraction</b>: divide both sides by the same number.</p><p>Example: 6 : 8 — both divisible by 2, so 6 : 8 = 3 : 4.</p><p><b>Your turn:</b> what’s the biggest number that divides both ${A} and ${B}?</p>` },
          { t: 'Hint 2 — check it', html: `<p>Divide both sides by that number. Can the result be simplified further? If yes, keep going.</p><p>Type your answer like <span class="mono">3:4</span>.</p>` },
        ],
      };
    }
    const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9), k = ri(rnd, 2, 6);
    const [ra, rb] = red(a, b); const A = ra * k, B = rb * k;
    const hideFirst = rnd() < 0.5;
    return {
      prompt: hideFirst
        ? `? : ${B} is equivalent to ${ra} : ${rb}. What is ?`
        : `${A} : ? is equivalent to ${ra} : ${rb}. What is ?`,
      answer: { kind: 'int', v: hideFirst ? A : B },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Equivalent ratios are made by <b>multiplying or dividing both sides by the same number</b> — just like equivalent fractions.</p><p>Example: 2 : 3 = 6 : ?. The left side was multiplied by 3 (2 × 3 = 6), so multiply the right side by 3 too: 3 × 3 = 9. Answer: 9.</p><p><b>Your turn:</b> look at the side you <i>can</i> see in both ratios. What was it multiplied (or divided) by?</p>` },
        { t: 'Hint 2 — apply it', html: `<p>Whatever that multiplier is, apply it to the <b>other</b> side to find your missing number.</p>` },
      ],
    };
  },
};

const ratiosT2 = {
  name: 'Solving proportions',
  gen(rnd, heat) {
    const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
    const [ra, rb] = red(a, b);
    const k = ri(rnd, 2, heat > 0.5 ? 12 : 8);
    const A = ra * k, B = rb * k;
    const left = rnd() < 0.5;
    return {
      prompt: left ? `${fracHTML('x', rb)} = ${fracHTML(A, B)} — find x` : `${fracHTML(ra, A)} = ${fracHTML('x', B)} — find x`,
      answer: { kind: 'int', v: left ? ra : rb },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>A proportion is just an equation of two <b>equivalent fractions</b>. Cross-multiplying turns it into a regular equation.</p><p>Example with <i>different</i> numbers: ${fracHTML('x', 5)} = ${fracHTML(6, 15)}. Cross-multiply: 15·x = 5·6, so 15x = 30, and x = 2.</p><p><b>Your turn:</b> cross-multiply your proportion — multiply each numerator by the <i>other</i> denominator. What equation do you get?</p>` },
        { t: 'Hint 2 — finish it', html: `<p>You should have something like (a number)·x = (another number). Divide both sides by the number in front of x.</p><p>Then check: does your x make the two fractions actually equal? Plug it back in.</p>` },
      ],
    };
  },
};

const ratiosT3 = {
  name: 'Unit rates & scaling',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const per = ri(rnd, 2, 9), n = ri(rnd, 2, 6);
      const total = per * n;
      const item = pick(rnd, ['apples', 'notebooks', 'pencils', 'stickers']);
      return {
        prompt: `${n} ${item} cost $${total}. What is the price per ${item.replace(/s$/, '')}? <span class="muted">(in dollars)</span>`,
        answer: { kind: 'decimal', v: per, tol: 0.005 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>A <b>unit rate</b> is the price for <i>one</i> item: total price ÷ number of items.</p><p>Example: 4 granola bars cost $6. Price per bar = 6 ÷ 4 = $1.50.</p><p><b>Your turn:</b> divide your total price by your number of items. What’s the price of one?</p>` },
        ],
      };
    }
    const scale = ri(rnd, 2, 10), dist = ri(rnd, 2, 9);
    const real = scale * dist;
    return {
      prompt: `A map uses the scale 1 cm : ${scale} km. Two towns are ${dist} cm apart on the map. How far apart are they really? <span class="muted">(in km)</span>`,
      answer: { kind: 'int', v: real },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>The scale tells you what <b>one</b> cm stands for. Each cm on the map = ${scale} km in real life — so multiply.</p><p>Example: scale 1 cm : 5 km, and 3 cm on the map → 3 × 5 = 15 km.</p><p><b>Your turn:</b> you have ${dist} cm, and each one means ${scale} km. What’s ${dist} × ${scale}?</p>` },
      ],
    };
  },
};

/* ------------------------------ PERCENTS ------------------------------ */
const percentsT1 = {
  name: 'Percent basics',
  gen(rnd, heat) {
    const kind = ri(rnd, 0, 2);
    if (kind === 0) {
      const p = pick(rnd, [10, 20, 25, 50, 75]);
      const whole = pick(rnd, [20, 40, 60, 80, 100, 200]);
      const v = (p / 100) * whole;
      return {
        prompt: `What is ${p}% of ${whole}?`,
        answer: Number.isInteger(v) ? { kind: 'int', v } : { kind: 'decimal', v: +v.toFixed(2), tol: 0.01 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Percent means “out of 100.”</b> So ${p}% of something = ${p}/100 of it. Friendly percents are shortcuts: 50% is a half, 25% is a quarter, 10% is a tenth.</p><p>Example: 25% of 40 = a quarter of 40 = 10.</p><p><b>Your turn:</b> what fraction is ${p}%? Now find that fraction <i>of</i> ${whole} — and “of” means multiply.</p>` },
          { t: 'Hint 2 — the 10% trick', html: `<p>10% of anything = just move the decimal point one place left (10% of 60 = 6). Then build up: 20% is two 10%s, 5% is half of 10%.</p><p>Can you build ${p}% out of 10% chunks?</p>` },
        ],
      };
    }
    if (kind === 1) {
      const f = pick(rnd, [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 10]]);
      const p = Math.round((f[0] / f[1]) * 100);
      return {
        prompt: `Write ${fracHTML(f[0], f[1])} as a percent. <span class="muted">(just the number)</span>`,
        answer: { kind: 'int', v: p },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>To turn a fraction into a percent, first make it <b>“out of 100.”</b></p><p>Example: ${fracHTML(3, 4)} — multiply top and bottom by 25 to get ${fracHTML(75, 100)}, and ${fracHTML(75, 100)} = 75%.</p><p><b>Your turn:</b> what do you multiply your denominator by to get 100? Do the same to the top — that’s your percent.</p>` },
        ],
      };
    }
    const d = pick(rnd, [0.25, 0.5, 0.75, 0.2, 0.4, 0.1, 0.05]);
    return {
      prompt: `Write ${d} as a percent. <span class="muted">(just the number)</span>`,
      answer: { kind: 'int', v: Math.round(d * 100) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>A decimal <i>is</i> already “out of” a power of 10: 0.35 = ${fracHTML(35, 100)} = 35%. So just <b>move the decimal point two places right</b>.</p><p>Example: 0.07 → 7%.</p><p><b>Your turn:</b> slide your decimal point two places to the right. What number do you get?</p>` },
      ],
    };
  },
};

const percentsT2 = {
  name: 'Percent of a number',
  gen(rnd, heat) {
    const p = ri(rnd, 5, 95);
    const whole = ri(rnd, 2, heat > 0.5 ? 30 : 12) * 10;
    const v = (p / 100) * whole;
    const val = +v.toFixed(1);
    return {
      prompt: `What is ${p}% of ${whole}? <span class="muted">(one decimal place is fine)</span>`,
      answer: { kind: 'decimal', v: val, tol: 0.06 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>“${p}% of ${whole}” means <b>${p}/100 × ${whole}</b>. A clean way: find <b>1%</b> first (divide by 100 — just move the point two places left), then multiply by ${p}.</p><p>Example: 30% of 50. 1% of 50 = 0.5. Then 30 × 0.5 = 15.</p><p><b>Your turn:</b> what’s 1% of ${whole}? Now multiply that by ${p}.</p>` },
        { t: 'Hint 2 — estimate', html: `<p>Sanity check with 10%: 10% of ${whole} = ${whole / 10}. Your answer for ${p}% should be about ${p / 10} times that. In the right ballpark?</p>` },
      ],
    };
  },
};

const percentsT3 = {
  name: 'Increase, decrease & find the whole',
  gen(rnd, heat) {
    const kind = ri(rnd, 0, 2);
    if (kind === 0) {
      const p = pick(rnd, [10, 15, 20, 25]);
      const whole = ri(rnd, 2, 20) * 10;
      const v = whole * (1 + p / 100);
      return {
        prompt: `A $${whole} jacket’s price increases by ${p}%. What is the new price? <span class="muted">(in dollars)</span>`,
        answer: { kind: 'decimal', v: +v.toFixed(2), tol: 0.01 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>An increase of ${p}% means the new price is <b>100% + ${p}% = ${100 + p}%</b> of the old price. Convert that to a decimal and multiply.</p><p>Example: $50 increased by 20% → 120% = 1.20 → 1.20 × 50 = $60.</p><p><b>Your turn:</b> ${p}% as a decimal, plus 1 — what multiplier do you get? Multiply your $${whole} by it.</p>` },
        ],
      };
    }
    if (kind === 1) {
      const p = pick(rnd, [10, 20, 25]);
      const whole = ri(rnd, 2, 20) * 10;
      const v = whole * (1 - p / 100);
      return {
        prompt: `A $${whole} game is on sale for ${p}% off. What is the sale price? <span class="muted">(in dollars)</span>`,
        answer: { kind: 'decimal', v: +v.toFixed(2), tol: 0.01 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>${p}% off means you pay <b>100% − ${p}% = ${100 - p}%</b> of the price. Turn that into a decimal and multiply.</p><p>Example: $80 with 25% off → you pay 75% = 0.75 → 0.75 × 80 = $60.</p><p><b>Your turn:</b> what percent do you actually pay? As a decimal, times $${whole}?</p>` },
        ],
      };
    }
    const p = pick(rnd, [20, 25, 50]);
    const whole = ri(rnd, 2, 12) * 10;
    const part = (p / 100) * whole;
    return {
      prompt: `${part} is ${p}% of what number?`,
      answer: { kind: 'int', v: whole },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>“${part} is ${p}% of ?” — work backwards: if ${p}% equals ${part}, then <b>1% equals ${part} ÷ ${p}</b>, and 100% is 100 times that.</p><p>Example: 12 is 30% of what? 1% = 12 ÷ 30 = 0.4. Whole = 0.4 × 100 = 40.</p><p><b>Your turn:</b> divide ${part} by ${p} to get 1%. Then × 100. What’s the whole?</p>` },
      ],
    };
  },
};

/* ------------------------------ PRE-ALGEBRA ------------------------------ */
const prealgT1 = {
  name: 'Expressions & one-step equations',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a = ri(rnd, 2, 9), b = ri(rnd, 1, 12), x = ri(rnd, 2, 9);
      const v = a * x + b;
      return {
        prompt: `Evaluate <b>${a}x + ${b}</b> when x = ${x}.`,
        answer: { kind: 'int', v },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Substitute</b>: replace every x with its value, then compute normally. Multiplication first!</p><p>Example: evaluate 4x − 3 when x = 5. Substitute: 4·5 − 3 = 20 − 3 = 17.</p><p><b>Your turn:</b> rewrite your expression with ${x} in place of x. What do you get?</p>` },
        ],
      };
    }
    const x = ri(rnd, 3, 15), b = ri(rnd, 2, 12);
    const add = rnd() < 0.5;
    const c = add ? x + b : x - b;
    if (!add && c <= 0) return prealgT1.gen(rnd, heat);
    return {
      prompt: add ? `x + ${b} = ${c} — find x` : `x − ${b} = ${c} — find x`,
      answer: { kind: 'int', v: x },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>To “undo” an equation, do the <b>opposite operation to both sides</b>. The goal: get x alone.</p><p>Example: x + 7 = 12. Undo “+ 7” with “− 7” on both sides: x = 12 − 7 = 5.</p><p><b>Your turn:</b> what’s the opposite of “${add ? `+ ${b}` : `− ${b}`}”? Do it to both sides — what is x?</p>` },
        { t: 'Hint 2 — check it', html: `<p>Plug your x back into the original equation. Does the left side really equal the right side? If not, recheck your undo step.</p>` },
      ],
    };
  },
};

const prealgT2 = {
  name: 'Two-step equations',
  gen(rnd, heat) {
    const a = ri(rnd, 2, 9), x = ri(rnd, 2, 12), b = ri(rnd, 1, 15);
    const c = a * x + b;
    const sub = rnd() < 0.35;
    if (sub) {
      const cc = a * x - b;
      if (cc <= 0) return prealgT2.gen(rnd, heat);
      return {
        prompt: `${a}x − ${b} = ${cc} — find x`,
        answer: { kind: 'int', v: x },
        hints: prealgHints(a, b, '−', cc),
      };
    }
    return {
      prompt: `${a}x + ${b} = ${c} — find x`,
      answer: { kind: 'int', v: x },
      hints: prealgHints(a, b, '+', c),
    };
  },
};
function prealgHints(a, b, op, c) {
  return [
    { t: 'Hint 1 — the idea', html: `<p>Undo in <b>reverse order of operations</b>: addition/subtraction first, then multiplication/division.</p><p>Example with <i>different</i> numbers: 3x + 4 = 19. First undo “+ 4”: 3x = 15. Then undo “× 3”: x = 5.</p><p><b>Your turn:</b> in your equation, what’s the ${op === '+' ? 'added' : 'subtracted'} number to undo first?</p>` },
    { t: 'Hint 2 — step one', html: `<p>Do the opposite of “${op} ${b}” to <b>both sides</b>. Now your equation should look like ${a}x = (some number). What’s that number?</p>` },
    { t: 'Hint 3 — step two', html: `<p>Now undo “× ${a}” by dividing both sides by ${a}. Then <b>check</b>: plug your x into the original equation — does ${a}·(your x) ${op} ${b} really equal ${c}?</p>` },
  ];
}

const prealgT3 = {
  name: 'Tougher equations',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 2, 6), x = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
      const c = x + b, rhs = a * c;
      return {
        prompt: `${a}(x + ${b}) = ${rhs} — find x`,
        answer: { kind: 'int', v: x },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>When x is inside parentheses, you have two good moves: <b>divide first</b> (undo the outside multiplication), or <b>distribute</b> (multiply through).</p><p>Example: 2(x + 3) = 16. Divide-first way: divide both sides by 2 → x + 3 = 8 → x = 5.</p><p><b>Your turn:</b> try dividing both sides of your equation by ${a} first. What simpler equation do you get?</p>` },
          { t: 'Hint 2 — finish it', html: `<p>You should now have x + ${b} = ${c}. That’s a one-step equation — undo the “+ ${b}”.</p>` },
        ],
      };
    }
    if (style === 1) {
      const x = ri(rnd, 2, 12), d = ri(rnd, 2, 9);
      const rhs = x * d, dd = ri(rnd, 2, 5);
      // x/d * dd ... keep simple: x/3 + 5 = 9 style
      const b = ri(rnd, 2, 9), c = Math.floor(x / dd) ;
      if (x % dd !== 0) return prealgT3.gen(rnd, heat);
      const cc = c + b;
      return {
        prompt: `x ÷ ${dd} + ${b} = ${cc} — find x`,
        answer: { kind: 'int', v: x },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Undo in reverse order: the “+ ${b}” happened last, so undo it <b>first</b>; the “÷ ${dd}” happened first, so undo it <b>last</b> (by multiplying).</p><p>Example: x ÷ 4 + 2 = 6. Undo “+ 2”: x ÷ 4 = 4. Undo “÷ 4”: x = 16.</p><p><b>Your turn:</b> undo your “+ ${b}” first. What does x ÷ ${dd} equal?</p>` },
          { t: 'Hint 2 — finish it', html: `<p>Now undo “÷ ${dd}” by multiplying both sides by ${dd}. Check by plugging back in!</p>` },
        ],
      };
    }
    const a = ri(rnd, 2, 5), b = ri(rnd, 2, 5), x = ri(rnd, 2, 9);
    const rhs = (a + b) * x;
    return {
      prompt: `${a}x + ${b}x = ${rhs} — find x`,
      answer: { kind: 'int', v: x },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Combine like terms</b> first: ${a}x and ${b}x are the same kind of thing, so add their coefficients.</p><p>Example: 4x + 3x = 35 → 7x = 35 → x = 5.</p><p><b>Your turn:</b> ${a} + ${b} = ? Rewrite your equation as (that)x = ${rhs}, then solve.</p>` },
      ],
    };
  },
};

/* --------------------------- FACTORS & EXPONENTS --------------------------- */
const factorsT1 = {
  name: 'Factors & divisibility',
  gen(rnd, heat) {
    const kind = ri(rnd, 0, 2);
    if (kind === 0) {
      const n = pick(rnd, [12, 18, 20, 24, 28, 30, 36]);
      const divs = [];
      for (let i = 1; i <= n; i++) if (n % i === 0) divs.push(i);
      return {
        prompt: `How many factors does ${n} have? <span class="muted">(count them: 1 and ${n} count too)</span>`,
        answer: { kind: 'int', v: divs.length },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Factors come in <b>pairs</b> that multiply to your number. Walk i = 1, 2, 3… upward: whenever i divides ${n} evenly, you’ve found <i>two</i> factors (i and ${n}÷i).</p><p>Example: factors of 12. 1×12, 2×6, 3×4 — that’s 6 factors: 1, 2, 3, 4, 6, 12.</p><p><b>Your turn:</b> list the pairs for ${n}. How many numbers are in your list?</p>` },
          { t: 'Hint 2 — don’t double-count', html: `<p>You can stop when the pairs start repeating (past √${n} ≈ ${Math.floor(Math.sqrt(n))}). And careful: if ${n} is a perfect square, the middle pair is a double like 6×6 — count 6 only once.</p>` },
        ],
      };
    }
    if (kind === 1) {
      const d = pick(rnd, [3, 4, 5, 9]);
      const q = ri(rnd, 11, 60);
      const n = d * q + ri(rnd, 1, d - 1);
      const r = n % d;
      return {
        prompt: `What is the remainder when ${n} is divided by ${d}?`,
        answer: { kind: 'int', v: r },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>The remainder is what’s <b>left over</b> after dividing out as many whole ${d}s as fit.</p><p>Example: 17 ÷ 5. Five goes into 17 three times (15), leaving 2. Remainder: 2.</p><p><b>Your turn:</b> how many whole ${d}s fit into ${n}? Multiply back and subtract — what’s left?</p>` },
          { t: 'Hint 2 — divisibility shortcut', html: `<p>Shortcuts: divisible by 3 if digits sum to a multiple of 3; by 9 if digits sum to a multiple of 9; by 5 if it ends in 0/5; by 4 if the last two digits form a multiple of 4. Does ${n} pass the test for ${d}? If not, the remainder is small — try the nearest multiple of ${d} below ${n}.</p>` },
        ],
      };
    }
    // list all factors (typed, not a prime/composite coin flip)
    const n = pick(rnd, [12, 18, 20, 24, 28, 30, 36]);
    const divs = [];
    for (let i = 1; i <= n; i++) if (n % i === 0) divs.push(i);
    return {
      prompt: `List <b>all</b> the factors of ${n}, smallest to largest, separated by commas.`,
      answer: { kind: 'text', accept: [divs.join(',')], normalize: 'numlist' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Factors come in <b>pairs</b> that multiply to your number. Walk 1, 2, 3… upward: whenever one divides ${n} evenly, you’ve found <i>two</i> factors.</p><p>Example: factors of 12 → 1×12, 2×6, 3×4, so: 1,2,3,4,6,12.</p><p><b>Your turn:</b> find the pairs for ${n}, then list every factor smallest to largest, like <span class="mono">1,2,3</span>.</p>` },
        { t: 'Hint 2 — don’t stop early', html: `<p>You can stop testing once the pairs start repeating (past √${n} ≈ ${Math.floor(Math.sqrt(n))}). Count your list — did you get them all, including 1 and ${n} itself?</p>` },
      ],
    };
  },
};

const factorsT2 = {
  name: 'GCF, LCM & prime factorization',
  gen(rnd, heat) {
    const kind = ri(rnd, 0, 2);
    if (kind === 0) {
      const g = ri(rnd, 2, 6), a = g * ri(rnd, 2, 6), b = g * ri(rnd, 2, 6);
      if (a === b) return factorsT2.gen(rnd, heat);
      return {
        prompt: `What is the GCF of ${a} and ${b}? <span class="muted">(greatest common factor)</span>`,
        answer: { kind: 'int', v: gcd(a, b) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>List the <b>factors</b> of each number, then take the <b>biggest one they share</b>.</p><p>Example: GCF of 12 and 18. Factors of 12: 1,2,3,4,6,12. Factors of 18: 1,2,3,6,9,18. Biggest shared: 6.</p><p><b>Your turn:</b> list the factors of ${a} and of ${b}. What’s the biggest number on both lists?</p>` },
          { t: 'Hint 2 — shortcut', html: `<p>Shortcut: any common factor must divide their <b>difference</b> too. ${a} − ${b} = ${Math.abs(a - b)}. The GCF is a factor of ${Math.abs(a - b)} — test its factors from biggest down.</p>` },
        ],
      };
    }
    if (kind === 1) {
      const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
      if (a === b) return factorsT2.gen(rnd, heat);
      return {
        prompt: `What is the LCM of ${a} and ${b}? <span class="muted">(least common multiple)</span>`,
        answer: { kind: 'int', v: lcm(a, b) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>List <b>multiples</b> of each number until you find one on both lists — the first one is the least.</p><p>Example: LCM of 4 and 6. Multiples of 4: 4, 8, <b>12</b>… Multiples of 6: 6, <b>12</b>… Answer: 12.</p><p><b>Your turn:</b> write multiples of ${a}, then multiples of ${b}. What’s the first match?</p>` },
          { t: 'Hint 2 — shortcut', html: `<p>Shortcut: LCM(a, b) = a × b ÷ GCF(a, b). If you can spot their GCF, one division gets you the LCM.</p>` },
        ],
      };
    }
    // prime factorization -> text answer like "2x2x2x3"
    const primes = [2, 3, 5, 7];
    const p1 = pick(rnd, primes), p2 = pick(rnd, primes);
    const e1 = ri(rnd, 1, 3), e2 = ri(rnd, 1, 2);
    const n = Math.pow(p1, e1) * Math.pow(p2, e2 === 1 && p2 === p1 ? 1 : e2);
    const facs = [];
    let tmp = n;
    for (const p of [2, 3, 5, 7, 11, 13]) while (tmp % p === 0) { facs.push(p); tmp /= p; }
    if (tmp > 1) facs.push(tmp);
    const canonical = facs.join('x');
    return {
      prompt: `Write the prime factorization of ${n}. <span class="muted">(like 2x2x3)</span>`,
      answer: { kind: 'text', accept: [canonical], normalize: 'factorlist' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Build a <b>factor tree</b>: split ${n} into any two factors, then keep splitting until every branch ends in a prime.</p><p>Example: 24 → 4 × 6 → (2×2) × (2×3) → 2×2×2×3. Type it as <span class="mono">2x2x2x3</span>.</p><p><b>Your turn:</b> split ${n} into two factors. Are both prime? If not, split the composite one again.</p>` },
        { t: 'Hint 2 — check it', html: `<p>Multiply your primes back together — do you get ${n}? Every factor in your answer must itself be prime (2, 3, 5, 7, 11…). Type them with <span class="mono">x</span> between, smallest first.</p>` },
      ],
    };
  },
};

const factorsT3 = {
  name: 'Powers',
  gen(rnd, heat) {
    const kind = ri(rnd, 0, 2);
    if (kind === 0) {
      const b = ri(rnd, 2, 9), e = ri(rnd, 2, heat > 0.5 ? 4 : 3);
      return {
        prompt: `What is ${b}<sup>${e}</sup>?`,
        answer: { kind: 'int', v: Math.pow(b, e) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>An exponent counts <b>repeated multiplication</b>: 3<sup>4</sup> = 3 × 3 × 3 × 3 = 81.</p><p><b>Your turn:</b> write ${b}<sup>${e}</sup> out as ${e} copies of ${b} multiplied together. Go left to right — what do you get?</p>` },
        ],
      };
    }
    if (kind === 1) {
      const e = ri(rnd, 2, 5);
      return {
        prompt: `What is 10<sup>${e}</sup>?`,
        answer: { kind: 'int', v: Math.pow(10, e) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Powers of 10 are easy: 10<sup>n</sup> is a <b>1 followed by n zeros</b>. 10<sup>3</sup> = 1000.</p><p><b>Your turn:</b> write a 1, then count out ${e} zeros after it.</p>` },
        ],
      };
    }
    const a = ri(rnd, 2, 5), b = a + ri(rnd, 1, 3);
    const ea = ri(rnd, 2, 3), eb = ri(rnd, 2, 3);
    const va = Math.pow(a, ea), vb = Math.pow(b, eb);
    if (va === vb) return factorsT3.gen(rnd, heat);
    return {
      prompt: `${a}<sup>${ea}</sup> and ${b}<sup>${eb}</sup> — type the <b>value</b> of the larger one.`,
      answer: { kind: 'int', v: Math.max(va, vb) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Don’t be fooled by the bigger base! <b>Evaluate each power</b> (write out the multiplication), then compare the results.</p><p>Example: 2<sup>5</sup> vs 5<sup>2</sup>. 2<sup>5</sup> = 32, but 5<sup>2</sup> = 25 — the “smaller” base wins, so you’d type 32.</p><p><b>Your turn:</b> compute ${a}<sup>${ea}</sup> and ${b}<sup>${eb}</sup> separately. Which value is larger? Type that number.</p>` },
      ],
    };
  },
};

/* ------------------------------ TOPIC REGISTRY ------------------------------ */
const TOPICS = [
  { id: 'fractions', name: 'Fractions', icon: '🍕', blurb: 'Simplify, equivalent fractions, add & subtract', tiers: [fractionsT1, fractionsT2, fractionsT3] },
  { id: 'decimals', name: 'Decimals', icon: '💵', blurb: 'Place value, operations, converting', tiers: [decimalsT1, decimalsT2, decimalsT3] },
  { id: 'order', name: 'Order of Operations', icon: '🧮', blurb: 'Parentheses, exponents, PEMDAS', tiers: [orderT1, orderT2, orderT3] },
  { id: 'negatives', name: 'Negative Numbers', icon: '🌡️', blurb: 'Add, subtract, multiply & divide', tiers: [negativesT1, negativesT2, negativesT3] },
  { id: 'ratios', name: 'Ratios & Proportions', icon: '⚖️', blurb: 'Simplify, solve, scale', tiers: [ratiosT1, ratiosT2, ratiosT3] },
  { id: 'percents', name: 'Percents', icon: '📊', blurb: 'Of a number, up & down', tiers: [percentsT1, percentsT2, percentsT3] },
  { id: 'prealgebra', name: 'Pre-Algebra', icon: '🔍', blurb: 'Expressions & solving for x', tiers: [prealgT1, prealgT2, prealgT3] },
  { id: 'factors', name: 'Factors & Exponents', icon: '🔢', blurb: 'GCF, LCM, primes, powers', tiers: [factorsT1, factorsT2, factorsT3] },
];
if (typeof module !== 'undefined') module.exports = { TOPICS, mulberry32 };
