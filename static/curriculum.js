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

/* --------------------------- LINEAR EQUATIONS (8th) --------------------------- */
function linStr(m, b) {
  let s = m === 1 ? 'x' : m === -1 ? '−x' : `${m}x`;
  if (b > 0) s += ` + ${b}`; else if (b < 0) s += ` − ${Math.abs(b)}`;
  return s;
}
const linearT1 = {
  name: 'Slope & y-intercept',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const m = pick(rnd, [-3, -2, -1, 1, 2, 3]);
      const dx = ri(rnd, 1, 3), dy = m * dx;
      const x1 = ri(rnd, 0, 5), y1 = ri(rnd, -5, 5);
      return {
        prompt: `Find the slope of the line through (${x1}, ${y1}) and (${x1 + dx}, ${y1 + dy}).`,
        answer: { kind: 'int', v: m },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Slope = <b>rise over run</b> = (change in y) ÷ (change in x).</p><p>Example: through (0, 1) and (2, 7). Rise = 7 − 1 = 6, run = 2 − 0 = 2, slope = 6 ÷ 2 = 3.</p><p><b>Your turn:</b> how much does y change between your two points? How much does x change? Divide.</p>` },
          { t: 'Hint 2 — sign check', html: `<p>Going left to right: if the line goes <b>up</b>, slope is positive; <b>down</b>, negative. Does your sign match the direction?</p>` },
        ],
      };
    }
    const m = ri(rnd, 2, 9) * pick(rnd, [1, -1]), b = ri(rnd, 1, 9) * pick(rnd, [1, -1]);
    return {
      prompt: `In y = ${linStr(m, b)}, what is the y-intercept? <span class="muted">(just the number)</span>`,
      answer: { kind: 'int', v: b },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>In <b>y = mx + b</b>, the y-intercept is the <b>b</b> — the number standing alone, where the line crosses the y-axis (where x = 0).</p><p>Example: y = 4x − 7. The y-intercept is −7.</p><p><b>Your turn:</b> in your equation, which number is the b?</p>` },
      ],
    };
  },
};

const linearT2 = {
  name: 'Write equations & solve both sides',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const m = pick(rnd, [2, 3, 4, 5, -2, -3, -4, -5]);
      const x0 = ri(rnd, 1, 6), y0 = ri(rnd, -4, 12);
      const b = y0 - m * x0;
      if (b === 0) return linearT2.gen(rnd, heat);
      const canonical = linStr(m, b).replace(/−/g, '-').replace(/\s/g, '');
      return {
        prompt: `A line has slope ${m} and passes through (${x0}, ${y0}). Write its equation as y = mx + b.`,
        answer: { kind: 'text', accept: [canonical], normalize: 'equation' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Start with <b>y = mx + b</b>. You know m and a point (x, y) — plug them in and solve for b.</p><p>Example: slope 2, point (1, 5). y = 2x + b → 5 = 2·1 + b → b = 3. Equation: y = 2x + 3.</p><p><b>Your turn:</b> plug your slope and point into y = mx + b. What’s b?</p>` },
          { t: 'Hint 2 — check it', html: `<p>Plug your point back into your finished equation. Does the left side really equal the right side? Type it like <span class="mono">y=2x+3</span>.</p>` },
        ],
      };
    }
    const a1 = ri(rnd, 3, 6), a2 = ri(rnd, 1, a1 - 1), x = ri(rnd, 2, 9), b2 = ri(rnd, 1, 9);
    const b1 = (a2 - a1) * x + b2;
    const fmt = (a, b) => `${a}x${b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)}`;
    return {
      prompt: `${fmt(a1, b1)} = ${fmt(a2, b2)} — find x`,
      answer: { kind: 'int', v: x },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Get all the x’s on <b>one side</b> and all the plain numbers on the <b>other</b>, undoing in reverse order.</p><p>Example: 3x + 5 = x + 11. Subtract x from both sides: 2x + 5 = 11. Subtract 5: 2x = 6. Divide: x = 3.</p><p><b>Your turn:</b> what do you subtract from both sides to get the x’s together?</p>` },
        { t: 'Hint 2 — check it', html: `<p>Plug your x into <b>both</b> sides of the original equation. Both sides should give the same number.</p>` },
      ],
    };
  },
};

const linearT3 = {
  name: 'Tougher linear equations',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 2, 4), b = ri(rnd, 2, 6), c = ri(rnd, 1, a - 1), x = ri(rnd, 2, 9);
      const d = a * (x + b) - c * x;
      return {
        prompt: `${a}(x + ${b}) = ${c}x + ${d} — find x`,
        answer: { kind: 'int', v: x },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Distribute first</b>, then solve like a both-sides equation.</p><p>Example: 2(x + 3) = x + 10. Distribute: 2x + 6 = x + 10. Subtract x: x + 6 = 10. Subtract 6: x = 4.</p><p><b>Your turn:</b> distribute the ${a} in your equation. What does it become?</p>` },
        ],
      };
    }
    if (style === 1) {
      const m = ri(rnd, 2, 5), xi = ri(rnd, 2, 9), b = -m * xi;
      return {
        prompt: `Find the x-intercept of y = ${linStr(m, b)}. <span class="muted">(the x-value where y = 0)</span>`,
        answer: { kind: 'int', v: xi },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>The x-intercept is where the line crosses the x-axis — where <b>y = 0</b>. Set y to 0 and solve for x.</p><p>Example: y = 2x − 6. Set 0 = 2x − 6 → 2x = 6 → x = 3. The x-intercept is 3.</p><p><b>Your turn:</b> set y = 0 in your equation. What equation do you get?</p>` },
        ],
      };
    }
    const a1 = ri(rnd, 3, 6), a2 = ri(rnd, 1, a1 - 1), x = ri(rnd, 2, 9);
    const b1 = -ri(rnd, 1, 9), b2 = (a1 - a2) * x + b1;
    const fmt = (a, b) => `${a}x${b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)}`;
    return {
      prompt: `${fmt(a1, b1)} = ${fmt(a2, b2)} — find x`,
      answer: { kind: 'int', v: x },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Same move as before, watching the signs: get x’s on one side, numbers on the other. Remember, subtracting a negative is adding.</p><p><b>Your turn:</b> subtract the smaller x-term from both sides first. What’s left?</p>` },
        { t: 'Hint 2 — check it', html: `<p>Plug your x into both sides. Equal? If not, recheck the sign step.</p>` },
      ],
    };
  },
};

/* ------------------------- SYSTEMS OF EQUATIONS (8th) ------------------------- */
const systemsT1 = {
  name: 'Where do lines meet?',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const x0 = ri(rnd, 2, 9), y0 = ri(rnd, -5, 10);
      const m1 = ri(rnd, 2, 4), m2 = pick(rnd, [-2, -1, 0, 1]);
      if (m1 === m2) return systemsT1.gen(rnd, heat);
      const b1 = y0 - m1 * x0, b2 = y0 - m2 * x0;
      return {
        prompt: `y = ${linStr(m1, b1)} and y = ${linStr(m2, b2)} — for what x do both give the same y?`,
        answer: { kind: 'int', v: x0 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Where the lines meet, their y’s are <b>equal</b> — so set the two right sides equal to each other and solve for x.</p><p>Example: y = 2x + 1 and y = x + 4. Set equal: 2x + 1 = x + 4 → x = 3. (Check: both give y = 7.)</p><p><b>Your turn:</b> set your two expressions equal. What equation do you get?</p>` },
        ],
      };
    }
    const m = ri(rnd, 2, 5) * pick(rnd, [1, -1]), b = ri(rnd, -6, 6), x = ri(rnd, 2, 6);
    return {
      prompt: `If y = ${linStr(m, b)} and x = ${x}, what is y?`,
      answer: { kind: 'int', v: m * x + b },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Substitute</b>: replace x with its value, then compute.</p><p>Example: y = 3x − 2 with x = 4 → y = 3·4 − 2 = 10.</p><p><b>Your turn:</b> rewrite your equation with ${x} in place of x. What’s y?</p>` },
      ],
    };
  },
};

const systemsT2 = {
  name: 'Solve a system',
  gen(rnd, heat) {
    const x0 = ri(rnd, 1, 9), y0 = ri(rnd, -5, 9);
    const m1 = ri(rnd, 2, 4), m2 = ri(rnd, -3, -1);
    const b1 = y0 - m1 * x0, b2 = y0 - m2 * x0;
    return {
      prompt: `Solve: y = ${linStr(m1, b1)} and y = ${linStr(m2, b2)}. <span class="muted">Type x,y</span>`,
      answer: { kind: 'text', accept: [`${x0},${y0}`], normalize: 'numlist' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>The solution is the point where the lines <b>meet</b>: set the two expressions equal, solve for x, then plug back to get y.</p><p>Example: y = 2x + 1 and y = −x + 7. Equal: 2x + 1 = −x + 7 → 3x = 6 → x = 2. Then y = 2·2 + 1 = 5. Answer: 2,5.</p><p><b>Your turn:</b> set your two expressions equal. What’s x?</p>` },
        { t: 'Hint 2 — finish it', html: `<p>Now plug your x into either original equation to get y. Check by plugging into the <i>other</i> equation — does it hold? Type your answer like <span class="mono">3,4</span>.</p>` },
      ],
    };
  },
};

const systemsT3 = {
  name: 'Elimination',
  gen(rnd, heat) {
    const x0 = ri(rnd, 2, 9), y0 = ri(rnd, 1, 9);
    const a1 = ri(rnd, 2, 6), a2 = ri(rnd, 1, a1 - 1), b = ri(rnd, 2, 4);
    const elimX = rnd() < 0.5;
    // eliminate y: share the y-coefficient; eliminate x: share the x-coefficient
    const c1 = elimX ? a1 * x0 + b * y0 : b * x0 + a1 * y0;
    const c2 = elimX ? a2 * x0 + b * y0 : b * x0 + a2 * y0;
    const eq = (a, bb, c) => `${a}x + ${bb}y = ${c}`;
    return {
      prompt: elimX
        ? `Solve: ${eq(a1, b, c1)} and ${eq(a2, b, c2)}. <span class="muted">Type x,y</span>`
        : `Solve: ${eq(b, a1, c1)} and ${eq(b, a2, c2)}. <span class="muted">Type x,y</span>`,
      answer: { kind: 'text', accept: [`${x0},${y0}`], normalize: 'numlist' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Elimination:</b> when both equations share a coefficient, subtract them — that variable vanishes and you’re left with a one-variable equation.</p><p>Example: 2x + 3y = 17 and 5x + 3y = 29. Subtract: 3x = 12 → x = 4. Then 2·4 + 3y = 17 → 3y = 9 → y = 3. Answer: 4,3.</p><p><b>Your turn:</b> which variable vanishes if you subtract your two equations? What’s left?</p>` },
        { t: 'Hint 2 — finish it', html: `<p>Solve for the remaining variable, then plug it into either original equation to get the other one. Check in both equations, then type <span class="mono">x,y</span>.</p>` },
      ],
    };
  },
};

/* ------------------------- PYTHAGOREAN THEOREM (8th) ------------------------- */
const TRIPLES = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25]];
function pickTriple(rnd, maxC) {
  const ok = TRIPLES.filter((t) => !maxC || t[2] <= maxC);
  return pick(rnd, ok);
}
const pythagT1 = {
  name: 'Find the hypotenuse',
  gen(rnd, heat) {
    const [a, b, c] = pickTriple(rnd, heat > 0.5 ? 30 : 17);
    const k = (c <= 13 && rnd() < 0.5) ? 2 : 1;
    return {
      prompt: `A right triangle has legs ${a * k} and ${b * k}. How long is the hypotenuse?`,
      answer: { kind: 'int', v: c * k },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Pythagoras: <b>a² + b² = c²</b>, where c is the hypotenuse (across from the right angle, the longest side).</p><p>Example: legs 3 and 4. 3² + 4² = 9 + 16 = 25 = c², so c = 5.</p><p><b>Your turn:</b> square your two legs and add. What number squared gives that total?</p>` },
        { t: 'Hint 2 — square root', html: `<p>You need the number that, times itself, equals your sum. Try whole numbers near it: does 6², 7², 8²… land on it?</p>` },
      ],
    };
  },
};
const pythagT2 = {
  name: 'Find a missing leg',
  gen(rnd, heat) {
    const [a, b, c] = pickTriple(rnd, heat > 0.5 ? 30 : 17);
    const k = (c <= 13 && rnd() < 0.5) ? 2 : 1;
    return {
      prompt: `A right triangle has hypotenuse ${c * k} and one leg ${a * k}. Find the other leg.`,
      answer: { kind: 'int', v: b * k },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Still a² + b² = c² — but now you know c and one leg, so <b>subtract</b>: (missing leg)² = c² − (known leg)².</p><p>Example: hypotenuse 13, leg 5. Missing² = 13² − 5² = 169 − 25 = 144, so missing = 12.</p><p><b>Your turn:</b> square your hypotenuse and your known leg, subtract. What squared gives the result?</p>` },
      ],
    };
  },
};
const pythagT3 = {
  name: 'Word problems & distance',
  gen(rnd, heat) {
    const [a, b, c] = pickTriple(rnd, 30);
    const k = (c <= 13 && rnd() < 0.5) ? 2 : 1;
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      return {
        prompt: `A ${c * k}-foot ladder leans against a wall with its base ${a * k} feet from the wall. How high up the wall does it reach? <span class="muted">(in feet)</span>`,
        answer: { kind: 'int', v: b * k },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Picture it: the ladder is the <b>hypotenuse</b>, the ground distance and the wall height are the <b>legs</b>. Use a² + b² = c².</p><p><b>Your turn:</b> which numbers are the hypotenuse and the known leg? Subtract their squares, then square-root.</p>` },
        ],
      };
    }
    if (style === 1) {
      return {
        prompt: `A rectangle is ${a * k} by ${b * k}. How long is its diagonal?`,
        answer: { kind: 'int', v: c * k },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>A rectangle’s diagonal splits it into two right triangles — the diagonal is the <b>hypotenuse</b>, the sides are the legs.</p><p><b>Your turn:</b> square the two sides, add, and take the square root.</p>` },
        ],
      };
    }
    return {
      prompt: `How far apart are (0, 0) and (${a * k}, ${b * k})?`,
      answer: { kind: 'int', v: c * k },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Distance on a grid is a hypotenuse: make a right triangle with legs equal to the x-difference and the y-difference.</p><p><b>Your turn:</b> your legs are ${a * k} and ${b * k}. Square, add, square-root.</p>` },
      ],
    };
  },
};

/* ---------------------- SCIENTIFIC NOTATION & ROOTS (8th) ---------------------- */
const scinotT1 = {
  name: 'Scientific notation basics',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const d = (ri(rnd, 12, 99) / 10).toFixed(1), k = ri(rnd, 3, 5);
      const N = Math.round(parseFloat(d) * Math.pow(10, k));
      const withCommas = N.toLocaleString('en-US');
      return {
        prompt: `Write ${withCommas} in scientific notation.`,
        answer: { kind: 'text', accept: [`${d}e${k}`], normalize: 'scinot' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Scientific notation is <b>one digit, a decimal, then × 10 to a power</b>. The power counts how many places the point moves.</p><p>Example: 45,000 → the point moves 4 places to get 4.5, so 4.5 × 10⁴. Type it as <span class="mono">4.5e4</span>.</p><p><b>Your turn:</b> where does the point go to leave one digit before it? How many places did it move?</p>` },
        ],
      };
    }
    const d = (ri(rnd, 12, 99) / 10).toFixed(1), k = ri(rnd, 3, 4);
    const N = Math.round(parseFloat(d) * Math.pow(10, k));
    return {
      prompt: `Write  ${d} × 10<sup>${k}</sup> as a regular number.`,
      answer: { kind: 'int', v: N },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>10<sup>k</sup> means “move the point k places right,” adding zeros as needed.</p><p>Example: 3.2 × 10³ → move the point 3 right: 3,200.</p><p><b>Your turn:</b> move your point ${k} places right. What number do you get?</p>` },
      ],
    };
  },
};
const scinotT2 = {
  name: 'Multiply & divide powers',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = pick(rnd, [2, 3, 4]), b = pick(rnd, [2, 3]);
      if (a * b >= 10) return scinotT2.gen(rnd, heat);
      const e1 = ri(rnd, 2, 5), e2 = ri(rnd, 2, 4);
      return {
        prompt: `(${a}×10<sup>${e1}</sup>) × (${b}×10<sup>${e2}</sup>) = ? <span class="muted">Write in scientific notation</span>`,
        answer: { kind: 'text', accept: [`${a * b}e${e1 + e2}`], normalize: 'scinot' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Multiply the <b>front numbers</b>, and <b>add the exponents</b>.</p><p>Example: (3×10⁴) × (2×10³). Front: 3 × 2 = 6. Exponents: 4 + 3 = 7. Answer: 6e7.</p><p><b>Your turn:</b> multiply your front numbers, add your exponents. Type it like <span class="mono">6e7</span>.</p>` },
        ],
      };
    }
    if (style === 1) {
      const e1 = ri(rnd, 4, 7), e2 = ri(rnd, 1, 3);
      return {
        prompt: `10<sup>${e1}</sup> ÷ 10<sup>${e2}</sup> = ? <span class="muted">Write in scientific notation</span>`,
        answer: { kind: 'text', accept: [`1e${e1 - e2}`], normalize: 'scinot' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Dividing powers of 10: <b>subtract the exponents</b>.</p><p>Example: 10⁶ ÷ 10² = 10⁴. Type it as <span class="mono">1e4</span>.</p><p><b>Your turn:</b> ${e1} − ${e2} = ?</p>` },
        ],
      };
    }
    const a = pick(rnd, [2, 3]), e = ri(rnd, 2, 4);
    return {
      prompt: `(${a}×10<sup>${e}</sup>)² = ? <span class="muted">Write in scientific notation</span>`,
      answer: { kind: 'text', accept: [`${a * a}e${2 * e}`], normalize: 'scinot' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Squaring hits <b>both</b> parts: square the front number, and <b>double</b> the exponent.</p><p>Example: (2×10³)² = 4 × 10⁶. Type it as <span class="mono">4e6</span>.</p><p><b>Your turn:</b> square your front number, double your exponent.</p>` },
      ],
    };
  },
};
const scinotT3 = {
  name: 'Square roots & cube roots',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const r = ri(rnd, 4, 13), n = r * r;
      return {
        prompt: `√${n} = ?`,
        answer: { kind: 'int', v: r },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>√n asks: “what number, times itself, equals n?”</p><p>Example: √49 = 7, because 7 × 7 = 49.</p><p><b>Your turn:</b> which whole number squared gives ${n}?</p>` },
        ],
      };
    }
    if (style === 1) {
      const r = ri(rnd, 3, 10), n = r * r + ri(rnd, 1, 2 * r);
      return {
        prompt: `√${n} is between which two whole numbers? <span class="muted">Type them, smallest first</span>`,
        answer: { kind: 'text', accept: [`${r},${r + 1}`], normalize: 'numlist' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Sandwich it between <b>perfect squares</b> you know.</p><p>Example: √50. 7² = 49 and 8² = 64, and 50 sits between 49 and 64 — so √50 is between 7 and 8.</p><p><b>Your turn:</b> which two perfect squares does ${n} sit between? Their roots are your answer.</p>` },
        ],
      };
    }
    const r = pick(rnd, [2, 3, 4, 5]), n = r * r * r;
    return {
      prompt: `∛${n} = ? <span class="muted">(cube root)</span>`,
      answer: { kind: 'int', v: r },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Cube root asks: “what number, times itself <b>three</b> times, equals n?”</p><p>Example: ∛27 = 3, because 3 × 3 × 3 = 27.</p><p><b>Your turn:</b> which whole number, cubed, gives ${n}?</p>` },
      ],
    };
  },
};

/* ---------- helpers for high-school topics ---------- */
// Format a polynomial from [degree, coeff] pairs, mirroring normalizePoly's
// canonical output ("x^2+5x+6", "6x+2", "-x^2+3x-1").
function fmtPoly(pairs) {
  const terms = pairs.filter(([, c]) => Math.abs(c) > 1e-9).sort((a, b) => b[0] - a[0]);
  if (!terms.length) return '0';
  let out = '';
  terms.forEach(([d, c], i) => {
    const abs = Math.abs(c);
    out += i === 0 ? (c < 0 ? '-' : '') : (c < 0 ? '-' : '+');
    out += d === 0 ? abs : (abs === 1 ? '' : abs);
    if (d !== 0) out += 'x' + (d === 1 ? '' : '^' + d);
  });
  return out;
}
// "x² + 3x + 2" display form (spaces + superscripts), from [a, b, c].
function quadDisplay(a, b, c) {
  let s = a === 1 ? 'x²' : a === -1 ? '−x²' : `${a}x²`;
  if (b !== 0) s += b > 0 ? ` + ${b === 1 ? '' : b}x` : ` − ${b === -1 ? '' : Math.abs(b)}x`;
  if (c !== 0) s += c > 0 ? ` + ${c}` : ` − ${Math.abs(c)}`;
  return s;
}

/* ----------------------------- QUADRATICS (9th) ----------------------------- */
const quadraticsT1 = {
  name: 'Solve factored form & evaluate',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      let r1 = ri(rnd, -9, 9), r2 = ri(rnd, -9, 9);
      if (r1 === 0 || r2 === 0 || r1 === r2) return quadraticsT1.gen(rnd, heat);
      if (r1 > r2) [r1, r2] = [r2, r1];
      const f = (r) => r >= 0 ? `(x − ${r})` : `(x + ${Math.abs(r)})`;
      return {
        prompt: `${f(r1)}${f(r2)} = 0 — find both values of x. <span class="muted">Type them, smallest first</span>`,
        answer: { kind: 'text', accept: [`${r1},${r2}`], normalize: 'numlist' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>If a product is 0, <b>one of the factors must be 0</b>. Set each factor to 0 and solve.</p><p>Example: (x − 2)(x + 5) = 0. Either x − 2 = 0 → x = 2, or x + 5 = 0 → x = −5. Answer: −5,2.</p><p><b>Your turn:</b> what does each of your factors give?</p>` },
        ],
      };
    }
    const a = ri(rnd, 1, 3), b = ri(rnd, -5, 5), c = ri(rnd, -5, 5), x0 = ri(rnd, 2, 6);
    return {
      prompt: `Evaluate ${quadDisplay(a, b, c)} when x = ${x0}.`,
      answer: { kind: 'int', v: a * x0 * x0 + b * x0 + c },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Substitute</b>: replace every x with ${x0}, then compute — exponents first.</p><p>Example: x² + 3x + 2 at x = 4 → 16 + 12 + 2 = 30.</p><p><b>Your turn:</b> rewrite your expression with ${x0} in place of x. What do you get?</p>` },
      ],
    };
  },
};
const quadraticsT2 = {
  name: 'Factor & solve',
  gen(rnd, heat) {
    let r1 = ri(rnd, -9, 9), r2 = ri(rnd, -9, 9);
    if (r1 === 0 || r2 === 0) return quadraticsT2.gen(rnd, heat);
    if (r1 > r2) [r1, r2] = [r2, r1];
    const b = r1 + r2, c = r1 * r2;
    const f = (r) => r >= 0 ? `(x-${r})` : `(x+${Math.abs(r)})`;
    if (rnd() < 0.5) {
      return {
        prompt: `Factor ${quadDisplay(1, -b, c)}. <span class="muted">Type it like (x+2)(x+3)</span>`,
        answer: { kind: 'text', accept: [f(r1) + f(r2)], normalize: 'factored' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>To factor x² + bx + c, find two numbers that <b>multiply to c</b> and <b>add to b</b>.</p><p>Example: x² + 7x + 12. Numbers that multiply to 12 and add to 7: 3 and 4. So (x + 3)(x + 4).</p><p><b>Your turn:</b> which two numbers multiply to ${c} and add to ${-b}?</p>` },
          { t: 'Hint 2 — check it', html: `<p>Multiply your two factors back out (FOIL). Do you get the original quadratic?</p>` },
        ],
      };
    }
    return {
      prompt: `Solve ${quadDisplay(1, -b, c)} = 0. <span class="muted">Type both values of x, smallest first</span>`,
      answer: { kind: 'text', accept: [`${r1},${r2}`], normalize: 'numlist' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Factor first</b>, then set each factor to 0.</p><p>Example: x² + 7x + 12 = 0 → (x + 3)(x + 4) = 0 → x = −3 or x = −4.</p><p><b>Your turn:</b> factor your quadratic. What are its roots?</p>` },
      ],
    };
  },
};
const quadraticsT3 = {
  name: 'Formula & vertex',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a = pick(rnd, [2, 3]);
      let r1 = ri(rnd, -8, 8), r2 = ri(rnd, -8, 8);
      if (r1 === 0 || r2 === 0 || r1 === r2) return quadraticsT3.gen(rnd, heat);
      if (r1 > r2) [r1, r2] = [r2, r1];
      const b = -a * (r1 + r2), c = a * r1 * r2;
      return {
        prompt: `Solve ${quadDisplay(a, b, c)} = 0. <span class="muted">Type both values of x, smallest first</span>`,
        answer: { kind: 'text', accept: [`${r1},${r2}`], normalize: 'numlist' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Use the <b>quadratic formula</b>: x = (−b ± √(b² − 4ac)) / 2a. First find the discriminant, b² − 4ac.</p><p>Example: 2x² − 10x + 8 = 0. a=2, b=−10, c=8. Discriminant: 100 − 64 = 36, √36 = 6. x = (10 ± 6)/4 → x = 4 or x = 1.</p><p><b>Your turn:</b> what are a, b, c in your equation? What’s the discriminant?</p>` },
        ],
      };
    }
    const a = pick(rnd, [1, 2]), k = ri(rnd, -6, 6);
    if (k === 0) return quadraticsT3.gen(rnd, heat);
    const b = -2 * a * k, c = ri(rnd, -8, 8);
    return {
      prompt: `Find the x-coordinate of the vertex of y = ${quadDisplay(a, b, c)}.`,
      answer: { kind: 'int', v: k },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>The vertex of y = ax² + bx + c sits at <b>x = −b / 2a</b> — the axis of symmetry.</p><p>Example: y = x² + 6x + 5. x = −6 / 2 = −3.</p><p><b>Your turn:</b> what are a and b in your equation? Compute −b / 2a.</p>` },
      ],
    };
  },
};

/* ------------------------------ GEOMETRY (9th–10th) ------------------------------ */
const geometryT1 = {
  name: 'Angles',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 15, 75);
      return {
        prompt: `Two angles are complementary. One is ${a}°. What is the other? <span class="muted">(in degrees)</span>`,
        answer: { kind: 'int', v: 90 - a },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Complementary</b> angles add to 90°.</p><p>Example: complementary to 35° is 90 − 35 = 55°.</p><p><b>Your turn:</b> 90 − ${a} = ?</p>` },
        ],
      };
    }
    if (style === 1) {
      const a = ri(rnd, 95, 165);
      return {
        prompt: `Two angles are supplementary. One is ${a}°. What is the other? <span class="muted">(in degrees)</span>`,
        answer: { kind: 'int', v: 180 - a },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Supplementary</b> angles add to 180° — they make a straight line.</p><p>Example: supplementary to 110° is 180 − 110 = 70°.</p><p><b>Your turn:</b> 180 − ${a} = ?</p>` },
        ],
      };
    }
    const a = ri(rnd, 25, 80), b = ri(rnd, 25, 170 - a - 25);
    return {
      prompt: `A triangle has angles ${a}° and ${b}°. What is the third angle? <span class="muted">(in degrees)</span>`,
      answer: { kind: 'int', v: 180 - a - b },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>A triangle’s angles always add to <b>180°</b>.</p><p>Example: angles 50° and 70° → third = 180 − 50 − 70 = 60°.</p><p><b>Your turn:</b> 180 − ${a} − ${b} = ?</p>` },
      ],
    };
  },
};
const geometryT2 = {
  name: 'Triangles & transversals',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 30, 80);
      const sameSide = rnd() < 0.5;
      return {
        prompt: `Two parallel lines are cut by a transversal. One angle is ${a}°. What is its ${sameSide ? 'same-side interior' : 'alternate interior'} angle? <span class="muted">(in degrees)</span>`,
        answer: { kind: 'int', v: sameSide ? 180 - a : a },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>With parallel lines: <b>alternate interior</b> angles are equal; <b>same-side interior</b> angles add to 180°.</p><p>Example: one angle 65° → alternate interior 65°, same-side interior 115°.</p><p><b>Your turn:</b> which rule fits your angle type?</p>` },
        ],
      };
    }
    if (style === 1) {
      const a = ri(rnd, 30, 90), b = ri(rnd, 30, 90);
      return {
        prompt: `A triangle has two remote interior angles ${a}° and ${b}°. What is the exterior angle? <span class="muted">(in degrees)</span>`,
        answer: { kind: 'int', v: a + b },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>The <b>exterior angle theorem</b>: an exterior angle equals the sum of the two remote (non-adjacent) interior angles.</p><p>Example: remote angles 40° and 75° → exterior 115°.</p><p><b>Your turn:</b> add your two remote angles.</p>` },
        ],
      };
    }
    const v = pick(rnd, [30, 40, 50, 60, 80, 100]);
    return {
      prompt: `An isosceles triangle has a vertex angle of ${v}°. What is each base angle? <span class="muted">(in degrees)</span>`,
      answer: { kind: 'int', v: (180 - v) / 2 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>An isosceles triangle’s two <b>base angles are equal</b>, and all three add to 180°.</p><p>Example: vertex 40° → the two base angles share 140°, so each is 70°.</p><p><b>Your turn:</b> 180 − ${v} = ? Split it in half.</p>` },
      ],
    };
  },
};
const geometryT3 = {
  name: 'Circles & coordinates',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const r = pick(rnd, [3, 4, 5, 6, 7, 8, 10]);
      return {
        prompt: `A circle has radius ${r}. What is its area? <span class="muted">Use π ≈ 3.14</span>`,
        answer: { kind: 'decimal', v: 3.14 * r * r },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Area of a circle = <b>π r²</b>.</p><p>Example: r = 5 → 3.14 × 25 = 78.5.</p><p><b>Your turn:</b> square your radius, then multiply by 3.14.</p>` },
        ],
      };
    }
    if (style === 1) {
      const r = pick(rnd, [3, 5, 7, 10]);
      return {
        prompt: `A circle has radius ${r}. What is its circumference? <span class="muted">Use π ≈ 3.14</span>`,
        answer: { kind: 'decimal', v: 2 * 3.14 * r },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Circumference = <b>2 π r</b>.</p><p>Example: r = 7 → 2 × 3.14 × 7 = 43.96.</p><p><b>Your turn:</b> 2 × 3.14 × ${r} = ?</p>` },
        ],
      };
    }
    // Midpoint: same-parity coordinates so the midpoint is an integer.
    const x1 = ri(rnd, 0, 8), y1 = ri(rnd, 0, 8);
    const dx = 2 * ri(rnd, 1, 5), dy = 2 * ri(rnd, 1, 5);
    const x2 = x1 + dx, y2 = y1 + dy;
    return {
      prompt: `What is the midpoint of (${x1}, ${y1}) and (${x2}, ${y2})? <span class="muted">Type x,y</span>`,
      answer: { kind: 'text', accept: [`${x1 + dx / 2},${y1 + dy / 2}`], normalize: 'numlist' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>The midpoint is the <b>average</b> of the x’s and the average of the y’s.</p><p>Example: midpoint of (2, 4) and (6, 10) → ((2+6)/2, (4+10)/2) = (4, 7).</p><p><b>Your turn:</b> average your two x’s, then average your two y’s.</p>` },
      ],
    };
  },
};

/* ---------------------- EXPONENTS & LOGARITHMS (10th–11th) ---------------------- */
const explogsT1 = {
  name: 'Exponent laws',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const m = ri(rnd, 2, 5), n = ri(rnd, 2, 4);
      return {
        prompt: `Write (x<sup>${m}</sup>)<sup>${n}</sup> as x^n. <span class="muted">Type it like x^5</span>`,
        answer: { kind: 'text', accept: [`x^${m * n}`], normalize: 'power' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Power of a power: <b>multiply the exponents</b>.</p><p>Example: (x³)⁴ = x¹², because 3 × 4 = 12.</p><p><b>Your turn:</b> ${m} × ${n} = ?</p>` },
        ],
      };
    }
    if (style === 1) {
      const b = pick(rnd, [2, 3, 5]), e = ri(rnd, 2, 3);
      return {
        prompt: `What is ${b}<sup>−${e}</sup> as a fraction?`,
        answer: { kind: 'fraction', n: 1, d: Math.pow(b, e) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>A negative exponent means <b>flip it</b>: b⁻ᵉ = 1 / bᵉ.</p><p>Example: 2⁻³ = 1 / 2³ = 1/8.</p><p><b>Your turn:</b> 1 over ${b}<sup>${e}</sup> = ?</p>` },
        ],
      };
    }
    const b = ri(rnd, 2, 6), e = pick(rnd, [2, 3]);
    return {
      prompt: `Evaluate ${b}<sup>${e}</sup>.`,
      answer: { kind: 'int', v: Math.pow(b, e) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>An exponent counts <b>repeated multiplication</b>.</p><p>Example: 4³ = 4 × 4 × 4 = 64.</p><p><b>Your turn:</b> write out your multiplication.</p>` },
      ],
    };
  },
};
const explogsT2 = {
  name: 'Exponential equations & logs',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const b = pick(rnd, [2, 3, 5]), e = ri(rnd, 2, 6);
      return {
        prompt: `Solve ${b}^x = ${Math.pow(b, e)}. Find x.`,
        answer: { kind: 'int', v: e },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Write the right side as a power of the same base, then the exponents must match.</p><p>Example: 2^x = 64 = 2⁶, so x = 6.</p><p><b>Your turn:</b> ${Math.pow(b, e)} is ${b} to what power?</p>` },
        ],
      };
    }
    if (style === 1) {
      const b = pick(rnd, [2, 3, 5, 10]), e = ri(rnd, 2, 5);
      return {
        prompt: `What is log<sub>${b}</sub>(${Math.pow(b, e)})?`,
        answer: { kind: 'int', v: e },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>log<sub>b</sub>(y) asks: “${b} to what power gives y?”</p><p>Example: log₂(32) = 5, because 2⁵ = 32.</p><p><b>Your turn:</b> ${b} to what power gives ${Math.pow(b, e)}?</p>` },
        ],
      };
    }
    const b = pick(rnd, [2, 3]), e = ri(rnd, 2, 5);
    return {
      prompt: `Solve ${b}^(x+1) = ${Math.pow(b, e)}. Find x.`,
      answer: { kind: 'int', v: e - 1 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>First match the exponents: x + 1 must equal the exponent on the right.</p><p>Example: 3^(x+1) = 81 = 3⁴, so x + 1 = 4 → x = 3.</p><p><b>Your turn:</b> what exponent gives your right side? Then solve x + 1 = that.</p>` },
      ],
    };
  },
};
const explogsT3 = {
  name: 'Log properties',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
      return {
        prompt: `log(${a}) + log(${b}) = log( ? ). What is ?`,
        answer: { kind: 'int', v: a * b },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Product rule:</b> log(a) + log(b) = log(a × b) — adding logs multiplies the insides.</p><p>Example: log(12) + log(3) = log(36).</p><p><b>Your turn:</b> ${a} × ${b} = ?</p>` },
        ],
      };
    }
    if (style === 1) {
      const b = pick(rnd, [2, 3]), e = ri(rnd, 3, 6);
      return {
        prompt: `Solve log<sub>${b}</sub>(x) = ${e}. Find x.`,
        answer: { kind: 'int', v: Math.pow(b, e) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>log<sub>b</sub>(x) = e means <b>x = bᵉ</b> — rewrite in exponential form.</p><p>Example: log₂(x) = 5 → x = 2⁵ = 32.</p><p><b>Your turn:</b> ${b}<sup>${e}</sup> = ?</p>` },
        ],
      };
    }
    const b = pick(rnd, [2, 3, 5]), e1 = ri(rnd, 2, 4), e2 = ri(rnd, 1, e1 - 1);
    return {
      prompt: `What is log<sub>${b}</sub>(${Math.pow(b, e1)}) − log<sub>${b}</sub>(${Math.pow(b, e2)})?`,
      answer: { kind: 'int', v: e1 - e2 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p><b>Quotient rule:</b> log(a) − log(b) = log(a ÷ b) — or just evaluate each log separately and subtract.</p><p>Example: log₅(125) − log₅(5) = 3 − 1 = 2.</p><p><b>Your turn:</b> what is each log by itself?</p>` },
      ],
    };
  },
};

/* ------------------------------ FUNCTIONS (9th–11th) ------------------------------ */
const functionsT1 = {
  name: 'Evaluate',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a = ri(rnd, 1, 3), b = ri(rnd, -4, 4), c = ri(rnd, -5, 5), x0 = ri(rnd, 2, 5);
      const f = `${quadDisplay(a, b, c)}`;
      return {
        prompt: `If f(x) = ${f}, what is f(${x0})?`,
        answer: { kind: 'int', v: a * x0 * x0 + b * x0 + c },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>f(${x0}) means <b>plug ${x0} in for x</b> everywhere, then compute.</p><p>Example: f(x) = x² + 3x + 2, f(4) = 16 + 12 + 2 = 30.</p><p><b>Your turn:</b> rewrite your function with ${x0} in place of x.</p>` },
        ],
      };
    }
    const a1 = ri(rnd, 2, 4), b1 = ri(rnd, -4, 4), a2 = ri(rnd, 2, 3), b2 = ri(rnd, -4, 4), x0 = ri(rnd, 2, 5);
    const inner = a2 * x0 + b2;
    return {
      prompt: `If f(x) = ${linStr(a1, b1)} and g(x) = ${linStr(a2, b2)}, what is f(g(${x0}))?`,
      answer: { kind: 'int', v: a1 * inner + b1 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Work <b>inside out</b>: find g(${x0}) first, then feed that result into f.</p><p>Example: f(x) = 3x + 2, g(x) = x − 1, f(g(4)). g(4) = 3, then f(3) = 11.</p><p><b>Your turn:</b> what is g(${x0})? Then plug that into f.</p>` },
        ],
      };
  },
};
const functionsT2 = {
  name: 'Composition & inverse',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a1 = pick(rnd, [2, 3]), b1 = ri(rnd, -5, 5);
      const a2 = pick(rnd, [2, 3]), b2 = ri(rnd, -5, 5);
      const A = a1 * a2, B = a1 * b2 + b1;
      return {
        prompt: `If f(x) = ${linStr(a1, b1)} and g(x) = ${linStr(a2, b2)}, find (f∘g)(x). <span class="muted">Type it like 2x-5</span>`,
        answer: { kind: 'text', accept: [fmtPoly([[1, A], [0, B]])], normalize: 'poly' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>(f∘g)(x) = f(g(x)): <b>replace x in f with the whole g(x)</b>, then simplify.</p><p>Example: f(x) = 2x + 1, g(x) = x − 3. f(g(x)) = 2(x − 3) + 1 = 2x − 5.</p><p><b>Your turn:</b> write f with (${linStr(a2, b2)}) in place of x. Distribute and combine.</p>` },
        ],
      };
    }
    const a = pick(rnd, [2, 3]), b = ri(rnd, -6, 6), x0 = ri(rnd, 2, 8);
    const y0 = a * x0 + b;
    return {
      prompt: `If f(x) = ${linStr(a, b)}, what is f⁻¹(${y0})? <span class="muted">(the inverse function, at ${y0})</span>`,
      answer: { kind: 'int', v: x0 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>f⁻¹(y) <b>undoes</b> f: it’s the x that f sends to y. Set f(x) = ${y0} and solve for x.</p><p>Example: f(x) = 2x + 4, f⁻¹(10). 2x + 4 = 10 → x = 3.</p><p><b>Your turn:</b> set your f(x) equal to ${y0}. What’s x?</p>` },
      ],
    };
  },
};
const functionsT3 = {
  name: 'Domain & transformations',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 2, 9);
      if (rnd() < 0.5) {
        return {
          prompt: `What is the domain of f(x) = √(x − ${a})? <span class="muted">Type it like x>=3</span>`,
          answer: { kind: 'text', accept: [`x>=${a}`], normalize: 'domain' },
          hints: [
            { t: 'Hint 1 — the idea', html: `<p>A square root needs a <b>non-negative</b> inside: x − a ≥ 0.</p><p>Example: f(x) = √(x − 3) → x − 3 ≥ 0 → x ≥ 3.</p><p><b>Your turn:</b> what must x − ${a} be? Solve for x.</p>` },
          ],
        };
      }
      return {
        prompt: `What is the domain of f(x) = 1/(x − ${a})? <span class="muted">Type it like x!=3</span>`,
        answer: { kind: 'text', accept: [`x!=${a}`], normalize: 'domain' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>You can’t <b>divide by zero</b> — the denominator can’t be 0.</p><p>Example: f(x) = 1/(x − 3) → x − 3 ≠ 0 → x ≠ 3.</p><p><b>Your turn:</b> what x makes your denominator 0? Exclude it.</p>` },
          ],
        };
    }
    if (style === 1) {
      const px = ri(rnd, 1, 8), py = ri(rnd, 1, 10);
      const h = pick(rnd, [-4, -3, -2, 2, 3, 4]), k = pick(rnd, [-5, -3, -2, 2, 3, 5]);
      const hs = h >= 0 ? `+ ${h}` : `− ${Math.abs(h)}`;
      const ks = k >= 0 ? `+ ${k}` : `− ${Math.abs(k)}`;
      return {
        prompt: `If g(x) = f(x ${hs}) ${ks}, the point (${px}, ${py}) on f moves to which point on g? <span class="muted">Type x,y</span>`,
        answer: { kind: 'text', accept: [`${px - h},${py + k}`], normalize: 'numlist' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Inside the function shifts x <b>opposite</b> (x + h moves left by h); outside shifts y <b>same direction</b>.</p><p>Example: g(x) = f(x + 2) − 3 moves (4, 10) to (2, 7): x − 2, y − 3.</p><p><b>Your turn:</b> how does your point’s x move? Its y?</p>` },
        ],
      };
    }
    const a = ri(rnd, 2, 5);
    return {
      prompt: `If f(x) = x², what is f(x + ${a}) expanded? <span class="muted">Type like x^2+4x+4</span>`,
      answer: { kind: 'text', accept: [fmtPoly([[2, 1], [1, 2 * a], [0, a * a]])], normalize: 'poly' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Replace x with (x + a) and <b>expand the square</b>: (x + a)² = x² + 2ax + a².</p><p>Example: f(x + 2) = (x + 2)² = x² + 4x + 4.</p><p><b>Your turn:</b> expand (x + ${a})². What are the three terms?</p>` },
      ],
    };
  },
};

/* --------------------------- TRIGONOMETRY (11th–12th) --------------------------- */
const TRIG_RAT = [ // [name, value as {n, d}] — only rational special-angle values
  ['sin(0°)', 0, 1], ['sin(30°)', 1, 2], ['sin(90°)', 1, 1],
  ['cos(0°)', 1, 1], ['cos(60°)', 1, 2], ['cos(90°)', 0, 1],
  ['tan(0°)', 0, 1], ['tan(45°)', 1, 1],
];
const trigT1 = {
  name: 'Right-triangle trig',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const [opp, adj, hyp] = pick(rnd, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]]);
      const fn = pick(rnd, ['sin', 'cos', 'tan']);
      const [num, den, label] = fn === 'sin' ? [opp, hyp, 'opposite / hypotenuse']
        : fn === 'cos' ? [adj, hyp, 'adjacent / hypotenuse']
        : [opp, adj, 'opposite / adjacent'];
      return {
        prompt: `In a right triangle, the side opposite angle A is ${opp} and the hypotenuse is ${hyp}. What is ${fn}(A)?`,
        answer: { kind: 'fraction', n: num, d: den },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>SOH CAH TOA</b>: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.</p><p>Example: opposite 3, hypotenuse 5 → sin = 3/5.</p><p><b>Your turn:</b> ${fn} = ${label}. What fraction is that?</p>` },
        ],
      };
    }
    const hyp = pick(rnd, [6, 8, 10, 12, 14]);
    if (rnd() < 0.5) {
      return {
        prompt: `In a 30°-60°-90° triangle, the hypotenuse is ${hyp}. What is the short leg?`,
        answer: { kind: 'int', v: hyp / 2 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>In a 30°-60°-90° triangle, the <b>short leg is half the hypotenuse</b>.</p><p>Example: hypotenuse 10 → short leg 5.</p><p><b>Your turn:</b> half of ${hyp} = ?</p>` },
        ],
      };
    }
    const short = ri(rnd, 3, 9);
    return {
      prompt: `In a 30°-60°-90° triangle, the short leg is ${short}. What is the hypotenuse?`,
      answer: { kind: 'int', v: 2 * short },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>In a 30°-60°-90° triangle, the <b>hypotenuse is twice the short leg</b>.</p><p>Example: short leg 4 → hypotenuse 8.</p><p><b>Your turn:</b> 2 × ${short} = ?</p>` },
      ],
    };
  },
};
const trigT2 = {
  name: 'Unit circle',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const [name, n, d] = pick(rnd, TRIG_RAT);
      return {
        prompt: `What is ${name}?`,
        answer: { kind: 'fraction', n, d },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Special angles have exact values worth memorizing: sin(30°) = 1/2, cos(60°) = 1/2, tan(45°) = 1, sin(90°) = 1, cos(90°) = 0.</p><p><b>Your turn:</b> picture the angle on the unit circle. What’s the value?</p>` },
        ],
      };
    }
    const [name, n, d] = pick(rnd, TRIG_RAT.filter(([, nn]) => nn !== 0));
    const fn = name.slice(0, 3), deg = name.slice(4, -2);
    return {
      prompt: `If ${fn}(θ) = ${d === 1 ? n : n + '/' + d} and θ is acute, what is θ? <span class="muted">(in degrees)</span>`,
      answer: { kind: 'int', v: parseInt(deg, 10) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Run the special-angle table <b>backwards</b>: which acute angle gives that value?</p><p>Example: sin(θ) = 1/2 → θ = 30°, because sin(30°) = 1/2.</p><p><b>Your turn:</b> which angle has ${fn} = ${d === 1 ? n : n + '/' + d}?</p>` },
      ],
    };
  },
};
const trigT3 = {
  name: 'Equations & identities',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const [name, n, d] = pick(rnd, TRIG_RAT.filter(([, nn]) => nn !== 0));
      const fn = name.slice(0, 3), deg = name.slice(4, -2);
      return {
        prompt: `Solve ${fn}(x) = ${d === 1 ? n : n + '/' + d} for 0° ≤ x ≤ 90°. Find x. <span class="muted">(in degrees)</span>`,
        answer: { kind: 'int', v: parseInt(deg, 10) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Ask: “which angle in range has this trig value?” Use the special-angle values.</p><p>Example: sin(x) = 1/2 for 0° ≤ x ≤ 90° → x = 30°.</p><p><b>Your turn:</b> which angle gives ${fn} = ${d === 1 ? n : n + '/' + d}?</p>` },
        ],
      };
    }
    if (style === 1) {
      const [n, d] = pick(rnd, [[1, 4], [1, 2], [3, 4]]);
      return {
        prompt: `If sin²(θ) = ${n}/${d}, what is cos²(θ)?`,
        answer: { kind: 'fraction', n: d - n, d },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>The Pythagorean identity: <b>sin²(θ) + cos²(θ) = 1</b>.</p><p>Example: sin²(θ) = 3/4 → cos²(θ) = 1 − 3/4 = 1/4.</p><p><b>Your turn:</b> 1 − ${n}/${d} = ?</p>` },
        ],
      };
    }
    const [name1, n1, d1] = pick(rnd, TRIG_RAT);
    const [name2, n2, d2] = pick(rnd, TRIG_RAT);
    const v1 = n1 / d1, v2 = n2 / d2, sum = v1 + v2;
    const num = Math.round(sum * 2), isHalf = Math.abs(sum * 2 - num) < 1e-9 && num % 2 === 1;
    return {
      prompt: `What is ${name1} + ${name2}?`,
      answer: isHalf ? { kind: 'fraction', n: num, d: 2 } : { kind: 'int', v: Math.round(sum) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Evaluate each term from the special-angle values, then add.</p><p>Example: tan(45°) + sin(90°) = 1 + 1 = 2.</p><p><b>Your turn:</b> what is each term by itself?</p>` },
      ],
    };
  },
};

/* ------------------------ SEQUENCES & SERIES (11th–12th) ------------------------ */
const sequencesT1 = {
  name: 'nth term',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a1 = ri(rnd, 1, 9), d = ri(rnd, 2, 6), n = ri(rnd, 8, 15);
      return {
        prompt: `An arithmetic sequence starts ${a1}, ${a1 + d}, ${a1 + 2 * d}, … What is the ${n}th term?`,
        answer: { kind: 'int', v: a1 + (n - 1) * d },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Arithmetic nth term: <b>aₙ = a₁ + (n − 1)d</b>, where d is the common difference.</p><p>Example: 3, 7, 11, … (d = 4). 10th term: 3 + 9 × 4 = 39.</p><p><b>Your turn:</b> what’s your d? Then ${a1} + ${n - 1} × d = ?</p>` },
        ],
      };
    }
    const a1 = ri(rnd, 2, 4), r = ri(rnd, 2, 3), n = ri(rnd, 4, 6);
    return {
      prompt: `A geometric sequence starts ${a1}, ${a1 * r}, ${a1 * r * r}, … What is the ${n}th term?`,
      answer: { kind: 'int', v: a1 * Math.pow(r, n - 1) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Geometric nth term: <b>aₙ = a₁ × rⁿ⁻¹</b>, where r is the common ratio.</p><p>Example: 2, 6, 18, … (r = 3). 5th term: 2 × 3⁴ = 162.</p><p><b>Your turn:</b> what’s your r? Then ${a1} × ${r}<sup>${n - 1}</sup> = ?</p>` },
        ],
      };
  },
};
const sequencesT2 = {
  name: 'Series sums',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a1 = ri(rnd, 1, 9), d = ri(rnd, 2, 5), n = ri(rnd, 6, 12);
      return {
        prompt: `What is the sum of the first ${n} terms of ${a1}, ${a1 + d}, ${a1 + 2 * d}, …?`,
        answer: { kind: 'int', v: (n / 2) * (2 * a1 + (n - 1) * d) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Arithmetic series: <b>Sₙ = n/2 × (2a₁ + (n−1)d)</b>. Or pair first+last, second+second-last…</p><p>Example: first 10 terms of 3, 7, 11, …: 10/2 × (6 + 36) = 210.</p><p><b>Your turn:</b> what’s the ${n}th term? Then average it with the first and multiply by ${n}.</p>` },
        ],
      };
    }
    const a1 = ri(rnd, 2, 3), r = ri(rnd, 2, 3), n = ri(rnd, 4, 5);
    return {
      prompt: `What is the sum of the first ${n} terms of ${a1}, ${a1 * r}, ${a1 * r * r}, …?`,
      answer: { kind: 'int', v: a1 * (Math.pow(r, n) - 1) / (r - 1) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Geometric series: <b>Sₙ = a₁(rⁿ − 1)/(r − 1)</b>.</p><p>Example: first 5 terms of 2, 6, 18, …: 2 × (3⁵ − 1)/2 = 242.</p><p><b>Your turn:</b> compute ${r}<sup>${n}</sup>, then plug in.</p>` },
        ],
      };
  },
};
const sequencesT3 = {
  name: 'Recursive & infinite',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a1 = ri(rnd, 1, 4), m = ri(rnd, 2, 3), add = ri(rnd, 1, 3), n = ri(rnd, 3, 5);
      let cur = a1;
      for (let i = 2; i <= n; i++) cur = m * cur + add;
      return {
        prompt: `A sequence is defined by a₁ = ${a1}, aₙ = ${m}aₙ₋₁ + ${add}. What is a<sub>${n}</sub>?`,
        answer: { kind: 'int', v: cur },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Build it <b>one term at a time</b>: each term comes from the previous one.</p><p>Example: a₁ = 2, aₙ = 3aₙ₋₁ + 1. a₂ = 7, a₃ = 22, a₄ = 67.</p><p><b>Your turn:</b> what’s a₂? Then a₃, and so on up to a<sub>${n}</sub>.</p>` },
        ],
      };
    }
    const a1 = pick(rnd, [2, 4]);
    const t2 = a1 / 2, t3 = a1 / 4;
    const fmt = (v) => Number.isInteger(v) ? String(v) : `1/${2 / v}`;
    return {
      prompt: `What is ${a1} + ${fmt(t2)} + ${fmt(t3)} + … (forever)?`,
      answer: { kind: 'int', v: 2 * a1 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Infinite geometric sum: <b>S = a₁ / (1 − r)</b>, when |r| < 1.</p><p>Example: 1 + 1/2 + 1/4 + … has a₁ = 1, r = 1/2 → S = 1 / (1 − 1/2) = 2.</p><p><b>Your turn:</b> what are a₁ and r in your series? Then ${a1} / (1 − 1/2) = ?</p>` },
      ],
    };
  },
};

/* --------------------- STATISTICS & PROBABILITY (10th–11th) --------------------- */
function pickDistinct(rnd, count, lo, hi) {
  const pool = [];
  for (let i = lo; i <= hi; i++) pool.push(i);
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
const statsT1 = {
  name: 'Mean, median, mode',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const mean = ri(rnd, 5, 14);
      let nums = null;
      for (let tries = 0; tries < 50 && !nums; tries++) {
        const first4 = [ri(rnd, 1, 20), ri(rnd, 1, 20), ri(rnd, 1, 20), ri(rnd, 1, 20)];
        const fifth = 5 * mean - first4.reduce((a, b) => a + b, 0);
        if (fifth >= 1 && fifth <= 20) nums = [...first4, fifth];
      }
      if (!nums) return statsT1.gen(rnd, heat);
      return {
        prompt: `What is the mean of ${nums.join(', ')}?`,
        answer: { kind: 'int', v: mean },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Mean = <b>add them all up, divide by how many</b>.</p><p>Example: mean of 4, 8, 6, 10, 2 → 30 ÷ 5 = 6.</p><p><b>Your turn:</b> what’s your total? Divide by 5.</p>` },
        ],
      };
    }
    if (style === 1) {
      const nums = pickDistinct(rnd, 5, 1, 30).sort((a, b) => a - b);
      return {
        prompt: `What is the median of ${nums.join(', ')}?`,
        answer: { kind: 'int', v: nums[2] },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Median = the <b>middle value</b> when sorted (half above, half below).</p><p>Example: median of 3, 9, 4, 12, 7 → sorted 3, 4, 7, 9, 12 → middle is 7.</p><p><b>Your turn:</b> sort your numbers. What’s in the middle?</p>` },
        ],
      };
    }
    const v = ri(rnd, 1, 9), w = ri(rnd, 1, 9), u = ri(rnd, 1, 9);
    if (v === w || v === u || w === u) return statsT1.gen(rnd, heat);
    const nums = [v, v, v, w, w, u];
    return {
      prompt: `What is the mode of ${nums.join(', ')}?`,
      answer: { kind: 'int', v },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Mode = the value that appears <b>most often</b>.</p><p>Example: mode of 2, 5, 2, 8, 5, 2 → 2 appears three times, more than any other.</p><p><b>Your turn:</b> count each value. Which shows up most?</p>` },
        ],
      };
  },
};
function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function choose(n, k) { return factorial(n) / (factorial(k) * factorial(n - k)); }
const statsT2 = {
  name: 'Probability & counting',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const red = ri(rnd, 2, 6), blue = ri(rnd, 3, 8);
      return {
        prompt: `A bag has ${red} red and ${blue} blue marbles. What is the probability of drawing red?`,
        answer: { kind: 'fraction', n: red, d: red + blue },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Probability = <b>what you want ÷ everything</b>.</p><p>Example: 3 red, 5 blue → P(red) = 3/8.</p><p><b>Your turn:</b> how many marbles total? Red over total = ?</p>` },
        ],
      };
    }
    if (style === 1) {
      const n = ri(rnd, 3, 5);
      return {
        prompt: `How many ways can ${n} people line up?`,
        answer: { kind: 'int', v: factorial(n) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Line-ups: <b>n! = n × (n−1) × … × 1</b> — choices shrink as spots fill.</p><p>Example: 4 people → 4 × 3 × 2 × 1 = 24.</p><p><b>Your turn:</b> ${n} × ${n - 1} × … × 1 = ?</p>` },
        ],
      };
    }
    const n = ri(rnd, 4, 7), k = ri(rnd, 2, 3);
    return {
      prompt: `How many ways can you choose ${k} toppings from ${n}? <span class="muted">(order doesn’t matter)</span>`,
      answer: { kind: 'int', v: choose(n, k) },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Choosing (order doesn’t matter): <b>C(n,k) = n! / (k! (n−k)!)</b>.</p><p>Example: choose 2 from 5 → 5! / (2! × 3!) = 10.</p><p><b>Your turn:</b> ${n}! ÷ (${k}! × ${n - k}!) = ?</p>` },
        ],
      };
  },
};
const statsT3 = {
  name: 'Conditional & expected value',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const r = ri(rnd, 3, 5), b = ri(rnd, 4, 7);
      return {
        prompt: `A bag has ${r} red and ${b} blue marbles. You draw one, keep it, then draw another. What is the probability both are red?`,
        answer: { kind: 'fraction', n: r * (r - 1), d: (r + b) * (r + b - 1) },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Without replacement, the bag <b>changes</b> after the first draw. Multiply the two probabilities.</p><p>Example: 4 red, 6 blue. P = (4/10) × (3/9) = 12/90 = 2/15.</p><p><b>Your turn:</b> P(first red) = ? Then with one fewer red and one fewer total, P(second red) = ? Multiply.</p>` },
        ],
      };
    }
    if (style === 1) {
      const pay = pick(rnd, [6, 12]);
      return {
        prompt: `A game pays $${pay} if you roll a 6 on a fair die, and $0 otherwise. What is the expected value? <span class="muted">(in dollars)</span>`,
        answer: { kind: 'int', v: pay / 6 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Expected value = <b>each outcome × its probability, added up</b>.</p><p>Example: win $6 with P = 1/6 → EV = 6 × 1/6 = 1.</p><p><b>Your turn:</b> ${pay} × (1/6) + 0 × (5/6) = ?</p>` },
        ],
      };
    }
    const sum = pick(rnd, [6, 7, 8]), ways = { 6: 5, 7: 6, 8: 5 }[sum];
    return {
      prompt: `What is the probability of rolling a sum of ${sum} with two dice?`,
      answer: { kind: 'fraction', n: ways, d: 36 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Count the winning pairs out of all <b>36</b> pairs (6 × 6).</p><p>Example: sum of 7 → (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) → 6/36 = 1/6.</p><p><b>Your turn:</b> list the pairs that add to ${sum}. How many? Over 36.</p>` },
        ],
      };
  },
};

/* ------------------------------ CALCULUS (12th) ------------------------------ */
const calculusT1 = {
  name: 'Limits & rates',
  gen(rnd, heat) {
    if (rnd() < 0.5) {
      const a = ri(rnd, 1, 3), b = ri(rnd, -4, 4), c = ri(rnd, -5, 5), x0 = ri(rnd, 2, 5);
      return {
        prompt: `What is the limit of ${quadDisplay(a, b, c)} as x approaches ${x0}?`,
        answer: { kind: 'int', v: a * x0 * x0 + b * x0 + c },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>For a polynomial, the limit is just <b>the value at that point</b> — plug in.</p><p>Example: limit of x² + 2x as x → 3 → 9 + 6 = 15.</p><p><b>Your turn:</b> plug ${x0} into your polynomial.</p>` },
        ],
      };
    }
    const x1 = ri(rnd, 1, 4), x2 = x1 + ri(rnd, 1, 4);
    return {
      prompt: `What is the average rate of change of f(x) = x² from x = ${x1} to x = ${x2}?`,
      answer: { kind: 'int', v: x1 + x2 },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Average rate of change = <b>(f(x₂) − f(x₁)) / (x₂ − x₁)</b> — the slope between two points on the graph.</p><p>Example: f(x) = x² from 1 to 3 → (9 − 1) / 2 = 4.</p><p><b>Your turn:</b> f(${x1}) = ? f(${x2}) = ? Then divide the change in f by the change in x.</p>` },
        ],
      };
  },
};
const calculusT2 = {
  name: 'Derivatives',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = ri(rnd, 2, 5), b = ri(rnd, 1, 6), c = ri(rnd, -5, 5);
      return {
        prompt: `Find f′(x) for f(x) = ${quadDisplay(a, b, c)}. <span class="muted">Type it like 6x+2</span>`,
        answer: { kind: 'text', accept: [fmtPoly([[1, 2 * a], [0, b]])], normalize: 'poly' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p><b>Power rule:</b> bring the exponent down and subtract one. Constants vanish.</p><p>Example: f(x) = 3x² + 2x → f′(x) = 6x + 2.</p><p><b>Your turn:</b> differentiate each term of your f(x).</p>` },
        ],
      };
    }
    if (style === 1) {
      const x0 = ri(rnd, 2, 7);
      return {
        prompt: `What is the slope of the tangent to f(x) = x² at x = ${x0}?`,
        answer: { kind: 'int', v: 2 * x0 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Tangent slope at x₀ = <b>f′(x₀)</b>. For f(x) = x², f′(x) = 2x.</p><p>Example: at x = 4 → slope = 2 × 4 = 8.</p><p><b>Your turn:</b> 2 × ${x0} = ?</p>` },
        ],
      };
    }
    const a = ri(rnd, 2, 4), b = ri(rnd, 1, 5);
    return {
      prompt: `Find f′(x) for f(x) = x³ + ${a}x² + ${b}x. <span class="muted">Type it like 3x^2+4x</span>`,
      answer: { kind: 'text', accept: [fmtPoly([[2, 3], [1, 2 * a], [0, b]])], normalize: 'poly' },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Power rule, term by term: x³ → 3x², ax² → 2ax, bx → b.</p><p>Example: f(x) = x³ + 2x² + 3x → f′(x) = 3x² + 4x + 3.</p><p><b>Your turn:</b> differentiate each term of your f(x).</p>` },
        ],
      };
  },
};
const calculusT3 = {
  name: 'Integrals',
  gen(rnd, heat) {
    const style = ri(rnd, 0, 2);
    if (style === 0) {
      const a = pick(rnd, [2, 4, 6]), b = ri(rnd, 1, 6);
      return {
        prompt: `Find the antiderivative of ${a}x + ${b} (omit +C). <span class="muted">Type it like x^2+3x</span>`,
        answer: { kind: 'text', accept: [fmtPoly([[2, a / 2], [1, b]])], normalize: 'poly' },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>Antiderivative = <b>reverse power rule</b>: raise the exponent by one, divide by the new exponent.</p><p>Example: ∫(2x + 3) dx = x² + 3x.</p><p><b>Your turn:</b> ${a}x becomes what? ${b} becomes what?</p>` },
        ],
      };
    }
    if (style === 1) {
      const u = pick(rnd, [2, 4, 6]);
      return {
        prompt: `Evaluate the integral from 0 to ${u} of x dx.`,
        answer: { kind: 'int', v: (u * u) / 2 },
        hints: [
          { t: 'Hint 1 — the idea', html: `<p>∫₀ᵘ x dx = [x²/2]₀ᵘ — evaluate the antiderivative at the top, minus at the bottom.</p><p>Example: ∫₀² x dx = 2²/2 − 0 = 2.</p><p><b>Your turn:</b> ${u}² / 2 = ?</p>` },
        ],
      };
    }
    const u = ri(rnd, 2, 5);
    return {
      prompt: `What is the area under f(x) = 2x from x = 0 to x = ${u}?`,
      answer: { kind: 'int', v: u * u },
      hints: [
        { t: 'Hint 1 — the idea', html: `<p>Area = the <b>definite integral</b>: antiderivative 2x → x², evaluated 0 to u.</p><p>Example: area under 2x from 0 to 3 = 3² = 9.</p><p><b>Your turn:</b> ${u}² = ?</p>` },
        ],
      };
  },
};

/* ------------------------------ TOPIC REGISTRY ------------------------------ */
// grades: per-tier US grade-level estimates (mainstream public-school
// curriculum, Common Core era). Approximate — states/districts vary.
const TOPICS = [
  { id: 'fractions', name: 'Fractions', icon: '🍕', blurb: 'Simplify, equivalent fractions, add & subtract', grades: [4, 4, 5], tiers: [fractionsT1, fractionsT2, fractionsT3] },
  { id: 'decimals', name: 'Decimals', icon: '💵', blurb: 'Place value, operations, converting', grades: [5, 5, 6], tiers: [decimalsT1, decimalsT2, decimalsT3] },
  { id: 'order', name: 'Order of Operations', icon: '🧮', blurb: 'Parentheses, exponents, PEMDAS', grades: [5, 5, 6], tiers: [orderT1, orderT2, orderT3] },
  { id: 'negatives', name: 'Negative Numbers', icon: '🌡️', blurb: 'Add, subtract, multiply & divide', grades: [7, 7, 8], tiers: [negativesT1, negativesT2, negativesT3] },
  { id: 'ratios', name: 'Ratios & Proportions', icon: '⚖️', blurb: 'Simplify, solve, scale', grades: [6, 7, 7], tiers: [ratiosT1, ratiosT2, ratiosT3] },
  { id: 'percents', name: 'Percents', icon: '📊', blurb: 'Of a number, up & down', grades: [6, 7, 7], tiers: [percentsT1, percentsT2, percentsT3] },
  { id: 'prealgebra', name: 'Pre-Algebra', icon: '🔍', blurb: 'Expressions & solving for x', grades: [7, 7, 8], tiers: [prealgT1, prealgT2, prealgT3] },
  { id: 'factors', name: 'Factors & Exponents', icon: '🔢', blurb: 'GCF, LCM, primes, powers', grades: [4, 6, 8], tiers: [factorsT1, factorsT2, factorsT3] },
  { id: 'linear', name: 'Linear Equations', icon: '📈', blurb: 'Slope, intercepts & solving', grades: [8, 8, 8], tiers: [linearT1, linearT2, linearT3] },
  { id: 'systems', name: 'Systems of Equations', icon: '🔀', blurb: 'Two equations, one answer', grades: [8, 8, 8], tiers: [systemsT1, systemsT2, systemsT3] },
  { id: 'pythag', name: 'Pythagorean Theorem', icon: '📐', blurb: 'Right triangles & distance', grades: [8, 8, 8], tiers: [pythagT1, pythagT2, pythagT3] },
  { id: 'scinotation', name: 'Scientific Notation & Roots', icon: '🔬', blurb: 'Big/small numbers, square roots', grades: [8, 8, 8], tiers: [scinotT1, scinotT2, scinotT3] },
  { id: 'quadratics', name: 'Quadratics', icon: '📉', blurb: 'Factor, solve & vertex form', grades: [9, 9, 10], tiers: [quadraticsT1, quadraticsT2, quadraticsT3] },
  { id: 'geometry', name: 'Geometry', icon: '📏', blurb: 'Angles, triangles, circles', grades: [9, 10, 10], tiers: [geometryT1, geometryT2, geometryT3] },
  { id: 'explogs', name: 'Exponents & Logarithms', icon: '⚡', blurb: 'Powers, exponential & log equations', grades: [10, 11, 11], tiers: [explogsT1, explogsT2, explogsT3] },
  { id: 'functions', name: 'Functions', icon: '🧩', blurb: 'Evaluate, compose, invert', grades: [9, 10, 11], tiers: [functionsT1, functionsT2, functionsT3] },
  { id: 'trig', name: 'Trigonometry', icon: '🌊', blurb: 'SOH CAH TOA, unit circle', grades: [11, 11, 12], tiers: [trigT1, trigT2, trigT3] },
  { id: 'sequences', name: 'Sequences & Series', icon: '🔗', blurb: 'Arithmetic, geometric, infinite', grades: [11, 11, 12], tiers: [sequencesT1, sequencesT2, sequencesT3] },
  { id: 'statistics', name: 'Statistics & Probability', icon: '🎲', blurb: 'Averages, counting, chance', grades: [10, 11, 11], tiers: [statsT1, statsT2, statsT3] },
  { id: 'calculus', name: 'Calculus', icon: '♾️', blurb: 'Limits, derivatives, integrals', grades: [12, 12, 12], tiers: [calculusT1, calculusT2, calculusT3] },
];
if (typeof module !== 'undefined') module.exports = { TOPICS, mulberry32 };
