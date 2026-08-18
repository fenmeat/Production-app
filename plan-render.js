function printPlan() {
	buildPrintLayout();
	setTimeout(() => window.print(), 50); // let the DOM update before the print dialog opens
}

function buildPrintLayout() {
	const dateObj = new Date(state.date + 'T12:00:00');
	const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
	const routesLabel = state.routes.length > 0 ? state.routes.join(' + ') : 'No routes scheduled';
	const periodLabel = state.period ? `<span class="pp-period">${state.period.replace('_', ' ')}</span>` : '';

	// Two-column product list, same visual pattern as the Sales App route printout
	const half = Math.ceil(state.products.length / 2);
	const leftProducts = state.products.slice(0, half);
	const rightProducts = state.products.slice(half);

	// Pooled Russians (R01-R04) already blend coldroom + fresh-cooked loose meat into one
	// "bags to pack" number, and bought-in items (Chicken, Six Gun, offal) are never actually
	// cooked — both belong under PACK on the printout, not PRODUCE, to avoid confusion.
	const packOnlyRow = p => RUSSIAN_CODES.includes(p.code) || BOUGHT_IN_CODES.includes(p.code);

	const productRow = p => {
		const packOnly = packOnlyRow(p);
		const labels = labelCount(p);
		return `
		<tr>
			<td class="pp-code">${p.code}</td>
			<td class="pp-name">${p.name}</td>
			<td class="pp-produce">${packOnly ? '' : (displayProduce(p) || '')}</td>
			<td class="pp-pack">${displayPack(p) || ''}</td>
			<td class="pp-labels">${labels || ''}</td>
			<td class="pp-actual"></td>
		</tr>`;
	};

	const productTable = products => `
		<table class="pp-table">
			<thead><tr><th>Code</th><th>Product</th><th>Produce</th><th>Pack</th><th>Labels</th><th>Actual</th></tr></thead>
			<tbody>${products.map(productRow).join('')}</tbody>
		</table>`;

	const trolleyRows = (state.trolleyAssignments || []).map((t, i) => `
		<tr>
			<td class="pp-tnum">${i + 1}</td>
			<td>${t.half1 || '—'}</td>
			<td>${t.half2 || '—'}</td>
		</tr>`).join('');

	const polonyRows = (state.polonyTrolleys || []).map((t, i) => `
		<tr>
			<td class="pp-tnum">${i + 1}</td>
			<td>${t.small || 0}</td>
			<td>${t.med || 0}</td>
			<td>${t.long || 0}</td>
		</tr>`).join('');

	const html = `
		<div class="pp-header">
			<div>
				<div class="pp-logo">FEN<span>MEAT</span></div>
				<div class="pp-route">${routesLabel} ${periodLabel}</div>
			</div>
			<div class="pp-date">
				<div>${state.date}</div>
				<div class="pp-day">${dayName}</div>
			</div>
		</div>

		<div class="pp-columns">
			<div>${productTable(leftProducts)}</div>
			<div>${productTable(rightProducts)}</div>
		</div>

		<div class="pp-box">
			<div class="pp-box-header">PRODUCTION TROLLEY PLAN — ${routesLabel} — ${state.date}</div>
			<div class="pp-box-body">
				${(state.trolleyAssignments && state.trolleyAssignments.length > 0) ? `
					<table class="pp-trolley-table">
						<thead><tr><th>#</th><th>Half 1</th><th>Half 2</th></tr></thead>
						<tbody>${trolleyRows}</tbody>
					</table>
				` : `<div class="pp-empty">No trolleys planned</div>`}

				<div class="pp-subtitle">Polony Trolley (casings)</div>
				${(state.polonyTrolleys && state.polonyTrolleys.length > 0) ? `
					<table class="pp-trolley-table">
						<thead><tr><th>#</th><th>Small</th><th>Med</th><th>Long</th></tr></thead>
						<tbody>${polonyRows}</tbody>
					</table>
				` : `<div class="pp-empty">No Polony trolleys planned</div>`}
			</div>
		</div>

		<div class="pp-footer">
			<span>https://fenmeat.github.io/production-app/</span>
			<span>${new Date().toLocaleString('en-GB')}</span>
		</div>
	`;
	document.getElementById('printArea').innerHTML = html;
}

function renderPlan() {
	// Totals always reflect ALL products, regardless of which sub-tab is open, so the summary
	// bar stays a full-picture overview even while a specific tab is being worked on.
	const totalForecast = state.products.reduce((s, p) => s + p.plannedQty, 0);
	const totalStock = state.products.reduce((s, p) => s + (p.stockQty || 0), 0);
	const totalProduce = state.products.reduce((s, p) => s + displayProduce(p), 0);
	const totalSurplus = state.products.reduce((s, p) => s + surplusQty(p), 0);

	const tab = state.planSubTab;

	const rt = state.russianTrolley;
	const trolleyCardInner = buildTrolleyCardHTML(rt, state.russianColdroomBatches);
	const trolleyCard = tab === 'russians' ? `<div class="trolley-card no-print" id="trolleyCard">${trolleyCardInner}</div>` : '';

	const polonyCardInner = buildPolonyCardHTML(state.polonyPlan);
	const polonyCard = tab === 'polony' ? `<div class="polony-card no-print" id="polonyCard">${polonyCardInner}</div>` : '';

	const trolleyPlanInner = buildTrolleyPlanCardHTML(state.batchesRequired, state.trolleyAssignments, state.polonyTrolleys);
	const trolleyPlanCard = tab === 'trolleys' ? `<div class="trolleyplan-card no-print" id="trolleyPlanCard">${trolleyPlanInner}</div>` : '';

	const summaryBar = `
		<div class="summary-bar no-print">
			<div class="summary-item">
				<div class="summary-val">${totalForecast}</div>
				<div class="summary-label">Forecast</div>
			</div>
			<div class="summary-item">
				<div class="summary-val">${totalStock}</div>
				<div class="summary-label">In Stock</div>
			</div>
			<div class="summary-item">
				<div class="summary-val" id="totalProduceVal">${totalProduce}</div>
				<div class="summary-label">To Produce</div>
			</div>
			<div class="summary-item">
				<div class="summary-val ${totalSurplus < 0 ? 'surplus-neg' : ''}" id="totalSurplusVal">${totalSurplus > 0 ? '+' : ''}${totalSurplus}</div>
				<div class="summary-label">Surplus</div>
			</div>
		</div>
	`;

	// The Trolleys tab is about trolley assignments, not individual products, so it has no
	// product table of its own — the trolleyPlanCard above is the whole tab.
	const productTable = tab === 'trolleys' ? '' : `
		${state.products.map((p, i) => {
			if (productFamily(p.code) !== tab) return '';
			const isPolony = POLONY_CODES.includes(p.code);
			const hasColdroom = COLDROOM_SCOPE_CODES.includes(p.code);
			const coldroomUnit = isPolony ? 'casings' : 'batches';
			const coldroomNeedsInput = hasColdroom && !(p.coldroomQty > 0);
			const produce = displayProduce(p);
			const isEnough = produce <= 0;
			const surplus = surplusQty(p);
			const surplusClass = surplus < 0 ? 'surplus-neg' : (surplus > 0 ? 'surplus-pos' : 'surplus-zero');
			const pack = displayPack(p);
			const labels = labelCount(p);
			return `
			<div class="prow" id="prow_${i}">
				<div class="prow-header" onclick="toggleRow(${i})">
					<div class="prow-name-wrap">
						<div class="prow-name">${p.name}<span class="prow-code">${p.code}</span></div>
					</div>
					<div class="prow-nums">
						<div class="prow-num"><span class="prow-num-label">Have</span><span class="prow-num-val" id="have_${i}">${p.stockQty || 0}</span></div>
						<div class="prow-num"><span class="prow-num-label">Need</span><span class="prow-num-val">${p.plannedQty}</span></div>
					</div>
					<div class="prow-status-wrap">
						<div class="prow-status ${isEnough ? 'ok' : 'produce'}" id="status_${i}">${isEnough ? '✅ Enough' : 'Produce ' + produce}</div>
						<div class="prow-status-batches" id="status_batches_${i}">${!isEnough ? batchLabel(p) : ''}</div>
					</div>
					<div class="prow-chevron">▼</div>
				</div>
				<div class="prow-detail">
					<div class="prow-detail-grid">
						<div class="prow-detail-field">
							<label>Stock</label>
							<input type="number" class="qty-input"
								id="stock_${i}" value="${p.stockQty || 0}" min="0"
								oninput="updateStockField(${i}, 'stockQty', this.value)"
								onfocus="this.select()">
							${isPolony ? `<div class="unit-hint">packed</div>` : ''}
						</div>
						${hasColdroom ? `
						<div class="prow-detail-field">
							<label>Coldroom (${coldroomUnit})</label>
							<input type="number" class="qty-input coldroom-input${coldroomNeedsInput ? ' needs-input' : ''}"
								id="coldroom_${i}" value="${p.coldroomQty || 0}" min="0" step="0.5"
								oninput="updateStockField(${i}, 'coldroomQty', this.value)"
								onfocus="this.select()">
							<div class="unit-hint" id="coldroom_hint_${i}">= ${coldroomBagsHint(p)} bags</div>
						</div>` : ''}
						<div class="prow-detail-field">
							<label>Produce</label>
							<div class="produce-input-row">
								<input type="number" class="qty-input produce-input"
									id="produce_${i}" value="${produce}" min="0"
									oninput="updateProduceOverride(${i}, this.value)"
									onfocus="this.select()">
								${tab === 'wors' && p.bagsPerBatch > 0 ? `
								<button type="button" class="add-batch-btn" onclick="addBatch(${i})">+1 batch</button>` : ''}
							</div>
							<div class="produce-batches" id="batches_${i}">${batchLabel(p)}</div>
						</div>
						<div class="prow-detail-field">
							<label>Pack</label>
							<input type="number" class="qty-input"
								id="pack_${i}" value="${pack}" min="0"
								oninput="updatePackOverride(${i}, this.value)"
								onfocus="this.select()">
							<div class="unit-hint" id="labelcount_${i}">${labels ? labels + ' labels' : ''}</div>
						</div>
						<div class="prow-detail-field">
							<label>Surplus</label>
							<div class="surplus-qty ${surplusClass}" id="surplus_${i}">${surplus > 0 ? '+' : ''}${surplus}</div>
						</div>
					</div>
				</div>
			</div>
		`;}).join('')}
	`;

	const html = `
		${trolleyCard}
		${polonyCard}
		${trolleyPlanCard}
		${summaryBar}
		${productTable}
		<div class="action-bar no-print">
			<button class="btn btn-print" onclick="printPlan()">🖨️ Print</button>
			<button class="btn btn-refresh" onclick="refreshApp()">🔄 Refresh</button>
			<button class="btn btn-save" onclick="saveStockLevels()">💾 Save Stock</button>
		</div>
	`;
	document.getElementById('mainContent').innerHTML = html;
}

function coldroomBagsFor(p) {
	if (COLDROOM_BATCH_CODES.includes(p.code)) {
		return (p.coldroomQty || 0) * (p.bagsPerBatch || 0);
	}
	return 0; // Polony's coldroom (casings) is handled separately in calcPolonyPlan
}

// How many bags the entered Coldroom quantity actually converts to — shown next to the
// Coldroom input so it's clear at a glance what "2 batches" or "3 casings" means in bags,
// not just an abstract count.
function coldroomBagsHint(p) {
	if (POLONY_CODES.includes(p.code)) {
		return (p.coldroomQty || 0) * (POLONY_BAGS_PER_CASING[p.code] || 0);
	}
	return coldroomBagsFor(p);
}

// Total bags to physically PACK today = everything currently sitting in coldroom for this
// product, PLUS whatever's being freshly produced today (Produce). This is deliberately NOT
// limited to "need" — once a coldroom batch is being packed, the whole batch gets packed
// (and any batches cooked fresh today get packed same-day too), regardless of what the
// Forecast/Stock netting alone would suggest. Example: 1 coldroom batch of Econo Russian
// (22 bags) + 2 fresh batches made today (44 bags) = 66 total to pack, even though the
// Produce number on its own only shows the 44 that still needed cooking.
function packToday(p) {
	if (POLONY_CODES.includes(p.code)) {
		const plan = state.polonyPlan[p.code];
		const coldroomBags = plan ? plan.bagsAvailable : 0;
		return coldroomBags + displayProduce(p);
	}
	if (COLDROOM_BATCH_CODES.includes(p.code)) {
		return coldroomBagsFor(p) + displayProduce(p);
	}
	return 0;
}

// Unclamped need — can go negative when Stock/Coldroom already exceed Forecast. Used only
// for Surplus, where a negative need correctly means "extra stock beyond what's needed".
function netNeed(p) {
	return p.plannedQty - (p.stockQty || 0) - coldroomBagsFor(p);
}

function rawNeed(p) {
	return Math.max(0, netNeed(p)); // clamped at 0 — used for batch rounding / Produce, since you can't "produce negative"
}

function batchesNeeded(p) {
	const bags = p.bagsPerBatch || 0;
	if (bags <= 0) return null;
	const need = rawNeed(p);
	if (need === 0) return 0;
	return Math.ceil(need / bags);
}

// Vienna / Cheese Vienna can be cooked as Full or Half batches — half-batch size
// is approximated as half of the full-batch bag yield (round to nearest bag).
function viennaBatchInfo(p) {
	const bagsPerBatch = p.bagsPerBatch || 0;
	const halfSize = Math.round(bagsPerBatch / 2);
	const need = rawNeed(p);
	if (need === 0) {
		return { fullBatches: 0, hasHalf: false, producedBags: 0, halfSize, bagsPerBatch };
	}
	if (bagsPerBatch <= 0) {
		// FIXED 12 August 2026 — bagsPerBatch missing/not yet loaded (e.g. a slow
		// getBagsPerBatch background call) used to make producedBags silently show
		// 0, which made the status badge read "✅ Enough" even though nothing had
		// actually been produced (real example: V01/V02, 13 Aug 2026, HAVE=0,
		// NEED=36/30, showed Enough). Every other product family falls back to
		// showing the raw unrounded Need in this situation (see batchesNeeded() /
		// produceQty()'s rawNeed(p) fallback) — Vienna now does the same instead
		// of zeroing out.
		return { fullBatches: 0, hasHalf: false, producedBags: need, halfSize, bagsPerBatch };
	}
	const halfUnitsNeeded = Math.ceil(need / halfSize);
	const fullBatches = Math.floor(halfUnitsNeeded / 2);
	const hasHalf = halfUnitsNeeded % 2 === 1;
	const producedBags = (fullBatches * bagsPerBatch) + (hasHalf ? halfSize : 0);
	return { fullBatches, hasHalf, producedBags, halfSize, bagsPerBatch };
}

function produceQty(p) {
	if (RUSSIAN_CODES.includes(p.code) && state.russianTrolley) {
		return state.russianTrolley.suggestedBags[p.code] || 0;
	}
	if (POLONY_CODES.includes(p.code) && state.polonyPlan[p.code]) {
		const casings = state.polonyPlan[p.code].casingsToMake;
		return casings * (POLONY_BAGS_PER_CASING[p.code] || 0);
	}
	if (VIENNA_CODES.includes(p.code)) {
		return viennaBatchInfo(p).producedBags;
	}
	if (SKIP_BATCH_CODES.includes(p.code)) {
		return rawNeed(p); // no batch rounding — cut from frozen stock as needed
	}
	const batches = batchesNeeded(p);
	if (batches === null) return rawNeed(p); // no recipe — produce exactly what's needed
	return batches * (p.bagsPerBatch || 0);
}

// The number actually shown/used everywhere: Alex's manual override if he's set one,
// otherwise the calculated suggestion. produceQty(p) itself is left untouched so the
// Trolley Plan / Polony Trolley Builder (which compute their own batch counts directly,
// not from this) are never affected by an override here.
function displayProduce(p) {
	return (p.produceOverride !== null && p.produceOverride !== undefined) ? p.produceOverride : produceQty(p);
}

// Added 28 July 2026 — Pack block. What Alex actually packs today, separate from what's
// being freshly produced: by default this equals Produce (packToday() already gives the
// right default for Polony/coldroom-batch items, which fold existing coldroom stock into
// the number to pack; for everything else packToday() returns 0, so it falls back to
// Produce). Always editable — e.g. Produce 52, but only Pack 26 today, rest stays as
// coldroom stock for tomorrow.
function displayPack(p) {
	if (p.packOverride !== null && p.packOverride !== undefined) return p.packOverride;
	const def = packToday(p);
	return def || displayProduce(p);
}

// Labels needed for however many bags are being packed today: each bag holds
// packsPerBag individual packets (1 label each), plus 1 label for the outside of the
// bag itself. Source: Master File, DATA sheet, Column G ("PACKS PER BAG") — NOT
// RECIPES_REF's BAGS_PER_BATCH, which is a different figure (bags per production
// batch, not packets per bag). Example: Braai Wors, 13 bags to pack, 10 packs/bag
// -> (13*10) + 13 = 143 labels.
// Products that never get labels printed, regardless of Pack quantity — bought-in
// items sold loose/bulk rather than packed into individually labelled packets.
const NO_LABEL_CODES = ['S01', 'S02', 'S03', 'O01', 'O02', 'O03']; // Six Gun 20g, Six Gun 200g, Chicken Souppack, Heads & Feet, Chicken Necks, Chicken Livers

function labelCount(p) {
	if (NO_LABEL_CODES.includes(p.code)) return 0;
	const bags = displayPack(p);
	if (!bags || !p.packsPerBag) return 0;
	return bags * (p.packsPerBag + 1);
}

function surplusQty(p) {
	if (POLONY_CODES.includes(p.code) && state.polonyPlan[p.code]) {
		// Polony's coldroom (casings) isn't accounted for by netNeed/coldroomBagsFor at all —
		// it's handled separately in calcPolonyPlan. True surplus = everything that will be
		// available (packed stock + all trolley casings + whatever's newly cooked) vs Forecast.
		const plan = state.polonyPlan[p.code];
		return (plan.packedStock + plan.bagsAvailable + displayProduce(p)) - plan.bagsNeeded;
	}
	return displayProduce(p) - netNeed(p);
}

function updateProduceOverride(idx, val) {
	const p = state.products[idx];
	p.produceOverride = (val === '' || val === null) ? null : (parseInt(val) || 0);

	const surplusEl = document.getElementById(`surplus_${idx}`);
	if (surplusEl) {
		const s = surplusQty(p);
		surplusEl.textContent = (s > 0 ? '+' : '') + s;
		surplusEl.className = 'surplus-qty ' + (s < 0 ? 'surplus-neg' : (s > 0 ? 'surplus-pos' : 'surplus-zero'));
	}
	refreshRowStatus(idx);

	const totalProduce = state.products.reduce((s, pr) => s + displayProduce(pr), 0);
	const totalProduceEl = document.getElementById('totalProduceVal');
	if (totalProduceEl) totalProduceEl.textContent = totalProduce;

	const totalSurplus = state.products.reduce((s, pr) => s + surplusQty(pr), 0);
	const totalSurplusEl = document.getElementById('totalSurplusVal');
	if (totalSurplusEl) {
		totalSurplusEl.textContent = (totalSurplus > 0 ? '+' : '') + totalSurplus;
		totalSurplusEl.className = 'summary-val ' + (totalSurplus < 0 ? 'surplus-neg' : '');
	}

	// Russian codes affect the pooled trolley's requirement and extra-capacity section —
	// recalculate the whole pool and refresh it (fix, 31 July 2026: previously the trolley
	// card was refreshed but state.russianTrolley itself was never recalculated here, so
	// the override never actually changed "Batches required to cook today").
	if (RUSSIAN_CODES.includes(p.code) && state.russianTrolley) {
		state.russianTrolley = calcRussiansTrolley(state.products, state.russianColdroomBatches);
		const trolleyEl = document.getElementById('trolleyCard');
		if (trolleyEl) trolleyEl.innerHTML = buildTrolleyCardHTML(state.russianTrolley, state.russianColdroomBatches);
		// The other three Russian sizes share the same pooled loose-meat total, so one
		// override can shift their suggested bag counts too — keep their rows in sync.
		state.products.forEach((p2, i2) => {
			if (RUSSIAN_CODES.includes(p2.code) && i2 !== idx) refreshProduceRow(i2);
		});
		// "Batches required to cook today" (Trolley Plan tab) tracks this pool's
		// batchesNeeded, which may have just changed — refresh it live.
		refreshTrolleyPlanCard();
	}
	// Polony codes affect the Polony card's Total Available/Surplus rows — refresh it
	if (POLONY_CODES.includes(p.code) && state.polonyPlan[p.code]) {
		const polonyEl = document.getElementById('polonyCard');
		if (polonyEl) polonyEl.innerHTML = buildPolonyCardHTML(state.polonyPlan);
	}

	// If Pack hasn't been manually overridden, its default tracks Produce — reflect that here
	if (p.packOverride === null || p.packOverride === undefined) {
		const packEl = document.getElementById(`pack_${idx}`);
		if (packEl) packEl.value = displayPack(p);
		const labelEl = document.getElementById(`labelcount_${idx}`);
		if (labelEl) labelEl.textContent = labelCount(p) ? labelCount(p) + ' labels' : '';
	}
}

// Added 28 July 2026 — Pack block override (see displayPack()). Only the Pack field and
// its Label Count hint depend on this — Surplus stays tied to Produce vs Need, unaffected.
function updatePackOverride(idx, val) {
	const p = state.products[idx];
	p.packOverride = (val === '' || val === null) ? null : (parseInt(val) || 0);

	const labelEl = document.getElementById(`labelcount_${idx}`);
	if (labelEl) labelEl.textContent = labelCount(p) ? labelCount(p) + ' labels' : '';
}

function batchLabel(p) {
	if (RUSSIAN_CODES.includes(p.code)) {
		return '🌭 pooled batch';
	}
	if (POLONY_CODES.includes(p.code) && state.polonyPlan[p.code]) {
		const plan = state.polonyPlan[p.code];
		if (plan.casingsToMake === 0) return plan.pakUitTrolley > 0 ? '✅ trolley only' : '';
		return `${plan.casingsToMake} casing${plan.casingsToMake > 1 ? 's' : ''} to cook`;
	}
	if (VIENNA_CODES.includes(p.code)) {
		const fullSize = p.bagsPerBatch || 0;
		if (fullSize <= 0) return '';
		const halfSize = Math.round(fullSize / 2);
		const bags = displayProduce(p); // respects a manual override
		if (bags === 0) return '';
		const fullBatches = Math.floor(bags / fullSize);
		const remainder = bags - (fullBatches * fullSize);
		const hasHalf = remainder >= Math.round(halfSize * 0.75); // treat a near-half remainder as "+half"
		const parts = [];
		if (fullBatches > 0) parts.push(`×${fullBatches} full`);
		if (hasHalf) parts.push('+half');
		return parts.join(' ') || '';
	}
	if (SKIP_BATCH_CODES.includes(p.code)) return '';
	if (p.bagsPerBatch > 0) {
		const batches = Math.round(displayProduce(p) / p.bagsPerBatch); // respects a manual override
		if (batches === 0) return '';
		return `×${batches} batch${batches > 1 ? 'es' : ''}`;
	}
	return '';
}

// POLONY is selectable here for Alex's own reference/bookkeeping, but is NOT part of the
// auto-plan generation or the Batches Required count — the Polony Trolley Builder (in the
// Polony Pack Plan card) is the authoritative place for casing counts per size.
function planTarget(p) {
	if (RUSSIAN_CODES.includes(p.code) || BOUGHT_IN_CODES.includes(p.code)) return displayProduce(p);
	if (POLONY_CODES.includes(p.code) || COLDROOM_BATCH_CODES.includes(p.code)) return packToday(p);
	return displayProduce(p);
}
