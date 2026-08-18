function updateStockField(idx, field, val) {
	state.products[idx][field] = field === 'coldroomQty' ? (parseFloat(val) || 0) : (parseInt(val) || 0);

	const haveEl = document.getElementById(`have_${idx}`);
	if (haveEl) haveEl.textContent = state.products[idx].stockQty || 0;

	if (field === 'coldroomQty') {
		const hintEl = document.getElementById(`coldroom_hint_${idx}`);
		if (hintEl) hintEl.textContent = `= ${coldroomBagsHint(state.products[idx])} bags`;
	}

	// If this is a Russian code, recalculate the whole trolley and refresh all Russian rows
	if (RUSSIAN_CODES.includes(state.products[idx].code)) {
		state.russianTrolley = calcRussiansTrolley(state.products, state.russianColdroomBatches);
		const trolleyEl = document.getElementById('trolleyCard');
		if (trolleyEl) {
			trolleyEl.innerHTML = buildTrolleyCardHTML(state.russianTrolley, state.russianColdroomBatches);
		}
		// Update all four Russian produce/batch/surplus cells
		state.products.forEach((p, i) => {
			if (RUSSIAN_CODES.includes(p.code)) refreshProduceRow(i);
		});
	} else if (POLONY_CODES.includes(state.products[idx].code)) {
		// Recalculate polony plan and refresh the polony card + this product's row
		state.polonyPlan = calcPolonyPlan(state.products);
		const polonyEl = document.getElementById('polonyCard');
		if (polonyEl) polonyEl.innerHTML = buildPolonyCardHTML(state.polonyPlan);
		// Update produce/batch/surplus cells for all polony rows
		state.products.forEach((p, i) => {
			if (POLONY_CODES.includes(p.code)) refreshProduceRow(i);
		});
	} else {
		refreshProduceRow(idx);
	}

	const totalStock = state.products.reduce((s, p) => s + (p.stockQty || 0), 0);
	const totalProduce = state.products.reduce((s, p) => s + displayProduce(p), 0);
	const totalStockEl = document.querySelectorAll('.summary-val')[1];
	if (totalStockEl) totalStockEl.textContent = totalStock;
	const totalProduceEl = document.getElementById('totalProduceVal');
	if (totalProduceEl) totalProduceEl.textContent = totalProduce;
	const totalSurplus = state.products.reduce((s, p) => s + surplusQty(p), 0);
	const totalSurplusEl = document.getElementById('totalSurplusVal');
	if (totalSurplusEl) {
		totalSurplusEl.textContent = (totalSurplus > 0 ? '+' : '') + totalSurplus;
		totalSurplusEl.className = 'summary-val ' + (totalSurplus < 0 ? 'surplus-neg' : '');
	}

	// Batches Required summary always stays live; manual trolley assignments are preserved
	refreshTrolleyPlanCard();
}

// Wors screen "+1 batch" button: instead of Alex working out bags-per-batch himself and
// typing the raw bag total, this adds exactly one batch's worth of bags on top of
// whatever Produce currently shows (suggested or already-overridden), then saves it as
// a manual override the same way typing into the Produce field would.
function addBatch(idx) {
	const p = state.products[idx];
	const bagsPerBatch = p.bagsPerBatch || 0;
	if (bagsPerBatch <= 0) return;
	const newVal = displayProduce(p) + bagsPerBatch;
	updateProduceOverride(idx, newVal);
	const produceEl = document.getElementById(`produce_${idx}`);
	if (produceEl) produceEl.value = newVal;
	const batchesEl = document.getElementById(`batches_${idx}`);
	if (batchesEl) batchesEl.textContent = batchLabel(p);
}

// Refreshes one row's Produce input (only if Alex hasn't manually overridden it), batch
// label, and Surplus cell — used after any Stock/Coldroom change.
function refreshProduceRow(idx) {
	const p = state.products[idx];
	const produceEl = document.getElementById(`produce_${idx}`);
	if (produceEl) produceEl.value = displayProduce(p);
	const batchesEl = document.getElementById(`batches_${idx}`);
	if (batchesEl) batchesEl.textContent = batchLabel(p);
	refreshRowStatus(idx);
	const surplusEl = document.getElementById(`surplus_${idx}`);
	if (surplusEl) {
		const s = surplusQty(p);
		surplusEl.textContent = (s > 0 ? '+' : '') + s;
		surplusEl.className = 'surplus-qty ' + (s < 0 ? 'surplus-neg' : (s > 0 ? 'surplus-pos' : 'surplus-zero'));
	}
}

function updateRussianColdroomBatches(val) {
	state.russianColdroomBatches = parseFloat(val) || 0;
	state.russianTrolley = calcRussiansTrolley(state.products, state.russianColdroomBatches);
	const rt = state.russianTrolley;

	const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
	setText('rt-needed', rt.totalLoose.toLocaleString());
	setText('rt-from-coldroom', rt.coldroomLoose.toLocaleString());
	setText('rt-new-batches', rt.batchesNeeded);
	setText('rt-total-available', rt.looseAvailable.toLocaleString());
	setText('rt-split-r01', rt.suggestedBags.R01);
	setText('rt-split-r02', rt.suggestedBags.R02);
	setText('rt-split-r03', rt.suggestedBags.R03);
	setText('rt-split-r04', rt.suggestedBags.R04);

	const extraEl = document.getElementById('rt-extra-section');
	if (extraEl) extraEl.innerHTML = buildRussianExtraSectionHTML(rt);

	// Toggle the "needs input" highlight on the input itself without recreating it
	const inputEl = document.getElementById('russianColdroomInput');
	if (inputEl) inputEl.classList.toggle('needs-input', !(state.russianColdroomBatches > 0));

	// R01-R04 produce/batch/surplus cells depend on the trolley allocation
	state.products.forEach((p, i) => {
		if (RUSSIAN_CODES.includes(p.code)) refreshProduceRow(i);
	});

	const totalProduce = state.products.reduce((s, p) => s + displayProduce(p), 0);
	const totalProduceEl = document.getElementById('totalProduceVal');
	if (totalProduceEl) totalProduceEl.textContent = totalProduce;
	const totalSurplus = state.products.reduce((s, p) => s + surplusQty(p), 0);
	const totalSurplusEl = document.getElementById('totalSurplusVal');
	if (totalSurplusEl) {
		totalSurplusEl.textContent = (totalSurplus > 0 ? '+' : '') + totalSurplus;
		totalSurplusEl.className = 'summary-val ' + (totalSurplus < 0 ? 'surplus-neg' : '');
	}

	// Trolley Plan Batches Required summary also depends on the Russians pool's batch count
	refreshTrolleyPlanCard();
}

async function saveTrolleyLayout() {
	await saveAll();
}

async function saveStockLevels() {
	await saveAll();
}

// Saves everything in one go: Stock/Coldroom levels (STOCK sheet) AND the date-specific
// layout — Trolley Plan assignments, Polony Trolley Builder, and Produce overrides
// (TROLLEY_PLAN_LOG, keyed by date). Both Save buttons call this, so either one saves
// everything — no need to remember which button covers what.
async function saveAll() {
	showToast('💾 Saving...', '');

	const stockRows = state.products.map(p => ({ code: p.code, qty: p.stockQty || 0, coldroomQty: p.coldroomQty || 0 }));
	stockRows.push({ code: 'RUSSIAN_TROLLEY', qty: 0, coldroomQty: state.russianColdroomBatches || 0 });

	const produceOverrides = {};
	state.products.forEach(p => {
		if (p.produceOverride !== null && p.produceOverride !== undefined) {
			produceOverrides[p.code] = p.produceOverride;
		}
	});

	try {
		const [stockResp, layoutResp] = await Promise.all([
			fetch(SCRIPT_URL, {
				method: 'POST',
				headers: {'Content-Type': 'text/plain'},
				body: JSON.stringify({ action: 'updateStockLevels', sheetId: NEW_SHEET_ID, rows: stockRows })
			}),
			fetch(SCRIPT_URL, {
				method: 'POST',
				headers: {'Content-Type': 'text/plain'},
				body: JSON.stringify({
					action: 'saveTrolleyPlan',
					sheetId: NEW_SHEET_ID,
					date: state.date,
					assignments: {
						trolleyAssignments: state.trolleyAssignments,
						polonyTrolleys: state.polonyTrolleys,
						produceOverrides: produceOverrides
					}
				})
			})
		]);
		const stockData = await stockResp.json();
		const layoutData = await layoutResp.json();

		if (stockData.status === 'ok' && layoutData.status === 'ok') {
			showToast('✅ Everything saved', 'success');
		} else {
			showToast('⚠️ ' + (stockData.message || layoutData.message || 'Some items failed to save'), 'error');
		}
	} catch (e) {
		showToast('⚠️ Network error — try again', 'error');
	}
}

// Single "target to log against" for LOG ACTUALS — mirrors the same Produce/Pack split used
// on the printout, but combined into one number since Log Actuals only has one Plan column.
// Pooled Russians and bought-in items: their number already covers everything (no separate
// coldroom pool to add). Polony and individually-coldroomed products: coldroom stock + fresh
// production combined, same as packToday() — otherwise Log Actuals showed "0" for a product
// that still has a full coldroom batch waiting to be packed, same bug as the Plan screen had.
