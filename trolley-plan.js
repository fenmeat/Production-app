const TROLLEY_BATCH_LABELS = ['RUSSIAN', 'ECONO RUSSIAN', 'CHEESE RUSSIAN', 'BABALAS RUSSIAN', 'VIENNA Full', 'VIENNA Half', 'CHEESE VIENNA Full', 'CHEESE VIENNA Half', 'POLONY'];
const POLONY_TROLLEY_CAPACITY = 10;
const MAX_TROLLEYS_PER_DAY = 8;

function trolleyBatchBags(label) {
	const findP = code => state.products.find(pr => pr.code === code);
	if (label === 'RUSSIAN') return RUSSIAN_BATCH_YIELD;
	if (label === 'ECONO RUSSIAN') { const p = findP('R05'); return p ? (p.bagsPerBatch || 0) : 0; }
	if (label === 'CHEESE RUSSIAN') { const p = findP('R06'); return p ? (p.bagsPerBatch || 0) : 0; }
	if (label === 'BABALAS RUSSIAN') { const p = findP('R07'); return p ? (p.bagsPerBatch || 0) : 0; }
	if (label === 'VIENNA Full') { const p = findP('V01'); return p ? (p.bagsPerBatch || 0) : 0; }
	if (label === 'VIENNA Half') { const p = findP('V01'); return p ? Math.round((p.bagsPerBatch || 0) / 2) : 0; }
	if (label === 'CHEESE VIENNA Full') { const p = findP('V02'); return p ? (p.bagsPerBatch || 0) : 0; }
	if (label === 'CHEESE VIENNA Half') { const p = findP('V02'); return p ? Math.round((p.bagsPerBatch || 0) / 2) : 0; }
	if (label === 'POLONY') return null; // varies by product — no single bag count
	return 0;
}

// How many whole batches are needed to produce at least `amount` bags.
function batchesFromAmount(amount, bagsPerBatch) {
	if (!bagsPerBatch || bagsPerBatch <= 0 || !amount || amount <= 0) return 0;
	return Math.ceil(amount / bagsPerBatch);
}

// Same Full/Half batch logic as viennaBatchInfo(), but driven by an explicit target amount
// (e.g. displayProduce(p), which respects a manual override) instead of always recalculating
// from rawNeed() internally.
function viennaBatchInfoFromAmount(amount, bagsPerBatch) {
	const halfSize = Math.round((bagsPerBatch || 0) / 2);
	if (!bagsPerBatch || bagsPerBatch <= 0 || !amount || amount <= 0) {
		return { fullBatches: 0, hasHalf: false, producedBags: 0, halfSize, bagsPerBatch };
	}
	const halfUnitsNeeded = Math.ceil(amount / halfSize);
	const fullBatches = Math.floor(halfUnitsNeeded / 2);
	const hasHalf = halfUnitsNeeded % 2 === 1;
	const producedBags = (fullBatches * bagsPerBatch) + (hasHalf ? halfSize : 0);
	return { fullBatches, hasHalf, producedBags, halfSize, bagsPerBatch };
}

function calcBatchesRequired(products, russianTrolley, polonyPlan) {
	const req = {};
	req['RUSSIAN'] = (russianTrolley && russianTrolley.batchesNeeded) || 0;

	// Derived from displayProduce(p) — the SAME number already shown on the product's row
	// (calculated suggestion, or Alex's manual override if he's set one) — so "Batches
	// Required" and the Trolley Plan always match what the RUSSIANS/VIENNA tabs say needs
	// producing, including anything Alex has deliberately overridden upward for buffer stock.
	const r05 = products.find(p => p.code === 'R05');
	req['ECONO RUSSIAN'] = r05 ? batchesFromAmount(displayProduce(r05), r05.bagsPerBatch) : 0;
	const r06 = products.find(p => p.code === 'R06');
	req['CHEESE RUSSIAN'] = r06 ? batchesFromAmount(displayProduce(r06), r06.bagsPerBatch) : 0;
	const r07 = products.find(p => p.code === 'R07');
	req['BABALAS RUSSIAN'] = r07 ? batchesFromAmount(displayProduce(r07), r07.bagsPerBatch) : 0;

	const v01 = products.find(p => p.code === 'V01');
	const v01info = v01 ? viennaBatchInfoFromAmount(displayProduce(v01), v01.bagsPerBatch) : { fullBatches: 0, hasHalf: false };
	req['VIENNA Full'] = v01info.fullBatches;
	req['VIENNA Half'] = v01info.hasHalf ? 1 : 0;

	const v02 = products.find(p => p.code === 'V02');
	const v02info = v02 ? viennaBatchInfoFromAmount(displayProduce(v02), v02.bagsPerBatch) : { fullBatches: 0, hasHalf: false };
	req['CHEESE VIENNA Full'] = v02info.fullBatches;
	req['CHEESE VIENNA Half'] = v02info.hasHalf ? 1 : 0;

	// Polony is no longer counted here — see the dedicated Polony Trolley Builder instead

	return req;
}

function buildDefaultTrolleyAssignments(req) {
	// Auto-plan only pairs within compatible groups — never mixes across them
	const RUSSIAN_FAMILY = ['RUSSIAN', 'ECONO RUSSIAN', 'CHEESE RUSSIAN', 'BABALAS RUSSIAN'];
	const VIENNA_FAMILY = ['VIENNA Full', 'VIENNA Half', 'CHEESE VIENNA Full', 'CHEESE VIENNA Half'];

	function buildUnits(labels) {
		const units = [];
		labels.forEach(label => {
			const count = req[label] || 0;
			for (let i = 0; i < count; i++) units.push(label);
		});
		return units;
	}
	function pairUnits(units) {
		const pairs = [];
		for (let i = 0; i < units.length; i += 2) {
			pairs.push({ half1: units[i] || '', half2: units[i + 1] || '' });
		}
		return pairs;
	}

	const russianUnits = buildUnits(RUSSIAN_FAMILY);
	const viennaUnits = buildUnits(VIENNA_FAMILY);

	const allPairs = [...pairUnits(russianUnits), ...pairUnits(viennaUnits)];
	return allPairs.slice(0, MAX_TROLLEYS_PER_DAY);
}

function calcTotalTrolleysNeeded(req) {
	const RUSSIAN_FAMILY = ['RUSSIAN', 'ECONO RUSSIAN', 'CHEESE RUSSIAN', 'BABALAS RUSSIAN'];
	const VIENNA_FAMILY = ['VIENNA Full', 'VIENNA Half', 'CHEESE VIENNA Full', 'CHEESE VIENNA Half'];
	const russianCount = RUSSIAN_FAMILY.reduce((s, l) => s + (req[l] || 0), 0);
	const viennaCount = VIENNA_FAMILY.reduce((s, l) => s + (req[l] || 0), 0);
	return Math.ceil(russianCount / 2) + Math.ceil(viennaCount / 2);
}

// Guarantees the trolley plan always has ENOUGH slots to cover every batch currently
// required — without discarding any existing rows Alex has manually set or reordered.
// Needed because loading a previously-saved plan (or a Produce number changing after the
// plan was last saved) could otherwise leave some required batches with nowhere to be
// cooked. Any shortfall is appended as additional trolley pairs, up to the daily cap.
function reconcileTrolleyAssignments(assignments, req) {
	const RUSSIAN_FAMILY = ['RUSSIAN', 'ECONO RUSSIAN', 'CHEESE RUSSIAN', 'BABALAS RUSSIAN'];
	const VIENNA_FAMILY = ['VIENNA Full', 'VIENNA Half', 'CHEESE VIENNA Full', 'CHEESE VIENNA Half'];
	const trackedLabels = [...RUSSIAN_FAMILY, ...VIENNA_FAMILY];

	// Work on a copy so nothing here mutates the caller's array in place.
	let result = assignments.map(a => ({ half1: a.half1, half2: a.half2 }));

	// STRIP EXCESS FIRST: a product that's now "✅ Enough" (req dropped to 0, or below what's
	// currently assigned) shouldn't keep a stale trolley slot just because it needed one
	// earlier in the session. Clear just the excess occurrences of that label, not the whole row.
	const excessToRemove = {};
	trackedLabels.forEach(label => {
		const countedNow = result.reduce((s, a) => s + (a.half1 === label ? 1 : 0) + (a.half2 === label ? 1 : 0), 0);
		excessToRemove[label] = Math.max(0, countedNow - (req[label] || 0));
	});
	result.forEach(a => {
		['half1', 'half2'].forEach(key => {
			const label = a[key];
			if (excessToRemove[label] > 0) {
				a[key] = '';
				a._stripped = true;
				excessToRemove[label]--;
			}
		});
	});
	// Only drop a row if it's empty AND that emptiness came from stripping excess above —
	// a row that started empty (e.g. just added via "+ Add Trolley", waiting for Alex to
	// pick something) must never be silently removed just because it has nothing in it yet.
	result = result.filter(a => a.half1 || a.half2 || !a._stripped);
	result.forEach(a => { delete a._stripped; });

	// REMOVED 12 August 2026 — this used to also "TOP UP SHORTFALL" by auto-adding new
	// pre-filled trolley rows whenever Produce numbers increased elsewhere. Alex plans
	// the Trolley table manually now (auto-pairing could mismatch how batches actually
	// get cooked together), so this function only ever strips no-longer-needed
	// assignments — it never adds or suggests new ones. Anything still needed shows up
	// in "Batches required to cook today" for Alex to add himself.
	return result.slice(0, MAX_TROLLEYS_PER_DAY);
}

function trolleyHalfSelectHTML(rowIdx, halfKey, currentVal) {
	const options = [''].concat(TROLLEY_BATCH_LABELS);
	return `<select class="tp-select" onchange="updateTrolleyHalf(${rowIdx}, '${halfKey}', this.value)">
		${options.map(o => `<option value="${o}" ${o === currentVal ? 'selected' : ''}>${o || '— empty —'}</option>`).join('')}
	</select>`;
}

function trolleyBagsLabel(label) {
	if (!label) return '';
	if (label === 'POLONY') return 'casing cook';
	return `${trolleyBatchBags(label)} bags`;
}

function buildTrolleyPlanCardHTML(req, assignments, polonyTrolleys) {
	const reqRows = TROLLEY_BATCH_LABELS.filter(l => (req[l] || 0) > 0)
		.map(l => `<div class="tp-req-row"><span>${l}</span><b>${req[l]}</b></div>`).join('');
	const reqSection = `
		<div class="tp-req-section">
			<div class="tp-req-title">Batches required to cook today</div>
			${reqRows || '<div class="tp-req-row"><span>Nothing new to cook</span></div>'}
		</div>
	`;

	const totalNeeded = calcTotalTrolleysNeeded(req);
	const overflowWarning = totalNeeded > MAX_TROLLEYS_PER_DAY ? `
		<div class="tp-warning">⚠️ ${totalNeeded} trolleys needed today, but max capacity is ${MAX_TROLLEYS_PER_DAY} — ${totalNeeded - MAX_TROLLEYS_PER_DAY} trolley${totalNeeded - MAX_TROLLEYS_PER_DAY > 1 ? 's' : ''} won't fit. Choose what to prioritise below, or carry the rest to tomorrow.</div>
	` : '';

	const rows = assignments.map((a, i) => {
		const b1 = trolleyBatchBags(a.half1);
		const b2 = trolleyBatchBags(a.half2);
		const hasPolony = a.half1 === 'POLONY' || a.half2 === 'POLONY';
		const totalDisplay = hasPolony ? '—' : ((b1 || 0) + (b2 || 0));
		return `
			<div class="tp-row">
				<div class="tp-num">${i + 1}</div>
				<div class="tp-half">${trolleyHalfSelectHTML(i, 'half1', a.half1)}<span class="tp-bags">${trolleyBagsLabel(a.half1)}</span></div>
				<div class="tp-half">${trolleyHalfSelectHTML(i, 'half2', a.half2)}<span class="tp-bags">${trolleyBagsLabel(a.half2)}</span></div>
				<div class="tp-total">${totalDisplay}</div>
				<div class="tp-remove no-print" onclick="removeTrolleyRow(${i})" title="Remove trolley">✕</div>
			</div>
		`;
	}).join('');

	// Polony trolleys are built and edited on the POLONY tab's Polony Trolley Builder, not
	// here — these rows are read-only, just so the full day's trolley picture is visible in
	// one place. Only shown if at least one Polony trolley has actually been planned.
	const polonyRows = (polonyTrolleys || []).map((t, i) => {
		const calc = calcPolonyTrolleyRow(t);
		return `
			<div class="tp-row tp-row-readonly">
				<div class="tp-num">P${i + 1}</div>
				<div class="tp-half"><span class="tp-readonly-label">Small ${t.small || 0} / Med ${t.med || 0} / Long ${t.long || 0}</span></div>
				<div class="tp-half"><span class="tp-readonly-label">(edit on POLONY tab)</span></div>
				<div class="tp-total">${calc.totalCasings} casings</div>
				<div></div>
			</div>
		`;
	}).join('');
	const polonySection = polonyRows ? `
		<div class="tp-header tp-polony-header">
			<div>#</div><div>POLONY TROLLEY</div><div></div><div>CASINGS</div>
		</div>
		${polonyRows}
	` : '';

	return `
		<div class="trolleyplan-title">🛒 Production Trolley Plan — editable (${assignments.length}/${MAX_TROLLEYS_PER_DAY} trolleys)</div>
		${overflowWarning}
		${reqSection}
		<div class="tp-header">
			<div>#</div><div>HALF 1</div><div>HALF 2</div><div>BAGS</div>
		</div>
		${rows || '<div class="tp-req-row"><span>No trolleys yet — add one below</span></div>'}
		${polonySection}
		<div class="tp-actions no-print">
			<button class="tp-btn" onclick="addTrolleyRow()">+ Add Trolley</button>
			<button class="tp-btn tp-btn-reset" onclick="resetTrolleyPlan()">🗑️ Clear All Trolleys</button>
			<button class="tp-btn tp-btn-save" onclick="saveTrolleyLayout()">💾 Save Layout</button>
		</div>
	`;
}

function refreshTrolleyPlanCard() {
	state.batchesRequired = calcBatchesRequired(state.products, state.russianTrolley, state.polonyPlan);
	state.trolleyAssignments = reconcileTrolleyAssignments(state.trolleyAssignments, state.batchesRequired);
	renderTrolleyPlanCardOnly();
}

// Re-renders the Trolley Plan card from whatever is CURRENTLY in state.trolleyAssignments,
// without running reconciliation. Used whenever Alex is directly editing the trolley plan
// himself (picking a dropdown value, adding/removing a row, resetting to auto-plan).
// Reconciliation belongs only on the path that reacts to changes made ELSEWHERE (Stock/
// Coldroom edits on other tabs) — never as a side effect of Alex's own edit here, otherwise
// a manual selection that isn't (yet) reflected in the calculated requirement gets silently
// wiped the instant it's made.
function renderTrolleyPlanCardOnly() {
	state.batchesRequired = calcBatchesRequired(state.products, state.russianTrolley, state.polonyPlan);
	const tpEl = document.getElementById('trolleyPlanCard');
	if (tpEl) tpEl.innerHTML = buildTrolleyPlanCardHTML(state.batchesRequired, state.trolleyAssignments, state.polonyTrolleys);
}

function updateTrolleyHalf(rowIdx, halfKey, value) {
	if (!state.trolleyAssignments[rowIdx]) return;
	state.trolleyAssignments[rowIdx][halfKey] = value;
	renderTrolleyPlanCardOnly();
}

function addTrolleyRow() {
	state.trolleyAssignments.push({ half1: '', half2: '' });
	renderTrolleyPlanCardOnly();
}

function removeTrolleyRow(rowIdx) {
	state.trolleyAssignments.splice(rowIdx, 1);
	renderTrolleyPlanCardOnly();
}

// CHANGED 12 August 2026 — was "reset to auto-plan"; now there's no auto-plan to reset
// to, so this just empties the table so Alex can rebuild it from scratch.
function resetTrolleyPlan() {
	state.trolleyAssignments = [];
	renderTrolleyPlanCardOnly();
}

// Speed fix (28 July 2026): split into fetch (pure network call, no side effects) and
// apply (pure state mutation, no network) so the fetch can run in Promise.all alongside
// loadStockLevels/loadBagsPerBatch/loadPacksPerBag, while the actual overriding of
// trolleyAssignments/polonyTrolleys/produceOverride still happens afterward, in the same
// order as before (after the freshly-built defaults, so it correctly overrides them).
async function fetchSavedTrolleyPlan() {
	try {
		// Fix (31 July 2026): this GET call was missing the cache-buster used elsewhere
		// (e.g. loadStockLevels) — mobile browsers (notably iPhone Safari) could serve a
		// stale cached response, making a plan saved on one device (e.g. Android) appear
		// missing when opened on another (e.g. iPhone), even though it saved correctly.
		const url = new URL(SCRIPT_URL);
		url.searchParams.set('action', 'getTrolleyPlan');
		url.searchParams.set('date', state.date);
		url.searchParams.set('sheetId', NEW_SHEET_ID);
		url.searchParams.set('_ts', Date.now());
		const resp = await fetch(url.toString(), { cache: 'no-store' });
		return await resp.json();
	} catch (e) {
		return null; // Non-fatal — falls back to the freshly-built auto-plan
	}
}

function applySavedTrolleyPlan(data) {
	if (data && data.status === 'ok' && data.found && data.assignments) {
		if (Array.isArray(data.assignments)) {
			// Backward compatibility with saves made before the Polony Trolley Builder existed
			if (data.assignments.length > 0) state.trolleyAssignments = data.assignments;
		} else {
			if (Array.isArray(data.assignments.trolleyAssignments) && data.assignments.trolleyAssignments.length > 0) {
				state.trolleyAssignments = data.assignments.trolleyAssignments;
			}
			if (Array.isArray(data.assignments.polonyTrolleys)) {
				state.polonyTrolleys = data.assignments.polonyTrolleys;
			}
			if (data.assignments.produceOverrides && typeof data.assignments.produceOverrides === 'object') {
				const overrides = data.assignments.produceOverrides;
				state.products.forEach(p => {
					if (overrides[p.code] !== undefined) p.produceOverride = overrides[p.code];
				});
			}
		}
	}
}
