function renderActuals() {
	const totalPlanned = state.products.reduce((s, p) => s + planTarget(p), 0);
	const totalActual = state.products.reduce((s, p) => s + (p.actualQty || 0), 0);
	const totalActualSurplus = state.products.reduce((s, p) => s + actualSurplusQty(p), 0);

	const html = `
		<div class="summary-bar no-print">
			<div class="summary-item">
				<div class="summary-val">${totalPlanned}</div>
				<div class="summary-label">Planned</div>
			</div>
			<div class="summary-item">
				<div class="summary-val" id="totalActualVal">${totalActual}</div>
				<div class="summary-label">Actual</div>
			</div>
			<div class="summary-item">
				<div class="summary-val ${totalActualSurplus < 0 ? 'surplus-neg' : ''}" id="totalActualSurplusVal">${totalActualSurplus > 0 ? '+' : ''}${totalActualSurplus}</div>
				<div class="summary-label">Surplus</div>
			</div>
		</div>
		<div class="product-header actuals-mode">
			<div>PRODUCT</div>
			<div style="text-align:center">PLAN</div>
			<div style="text-align:center">ACTUAL</div>
			<div style="text-align:center">COLDROOM</div>
			<div style="text-align:center">SURPLUS</div>
		</div>
		${state.products.map((p, i) => {
			const s = actualSurplusQty(p);
			const sClass = s < 0 ? 'surplus-neg' : (s > 0 ? 'surplus-pos' : 'surplus-zero');
			return `
			<div class="product-row actuals-mode">
				<div>
					<div class="product-name">${p.name}</div>
					<div class="product-code">${p.code}</div>
				</div>
				<div class="plan-qty">${planTarget(p)}</div>
				<div>
					<input type="number" class="qty-input"
						id="actual_${i}" value="${p.actualQty === null || p.actualQty === undefined ? '' : p.actualQty}" min="0"
						oninput="updateActual(${i}, this.value)"
						onfocus="this.select()">
				</div>
				<div>
					<input type="number" class="qty-input"
						id="actualColdroom_${i}" value="${p.actualColdroom === null || p.actualColdroom === undefined ? '' : p.actualColdroom}" min="0"
						oninput="updateActualColdroom(${i}, this.value)"
						onfocus="this.select()">
				</div>
				<div class="surplus-qty ${sClass}" id="actualSurplus_${i}">${s > 0 ? '+' : ''}${s}</div>
			</div>
		`;}).join('')}
		<div class="action-bar no-print">
			<button class="btn btn-save" onclick="saveActuals()">💾 Save Actuals</button>
		</div>
	`;
	document.getElementById('mainContent').innerHTML = html;
}

// Actual Surplus = what was actually PACKED plus whatever went to Coldroom instead (not
// packed today, but still made — e.g. an extra batch cooked for tomorrow) minus the net bags
// needed. Without the Coldroom part, a batch that was cooked but deliberately held back for
// tomorrow would show as a false shortfall instead of correctly counting as stock made today.
function actualSurplusQty(p) {
	const coldroomAdded = p.actualColdroom || 0;
	if (POLONY_CODES.includes(p.code) && state.polonyPlan[p.code]) {
		const plan = state.polonyPlan[p.code];
		return (plan.packedStock + plan.bagsAvailable + (p.actualQty || 0) + coldroomAdded) - plan.bagsNeeded;
	}
	return (p.actualQty || 0) + coldroomAdded - planTarget(p);
}

function updateActual(idx, val) {
	state.products[idx].actualQty = (val === '' || val === null) ? null : (parseInt(val) || 0);
	const total = state.products.reduce((s, p) => s + (p.actualQty || 0), 0);
	const totalEl = document.getElementById('totalActualVal');
	if (totalEl) totalEl.textContent = total;

	const s = actualSurplusQty(state.products[idx]);
	const surplusEl = document.getElementById(`actualSurplus_${idx}`);
	if (surplusEl) {
		surplusEl.textContent = (s > 0 ? '+' : '') + s;
		surplusEl.className = 'surplus-qty ' + (s < 0 ? 'surplus-neg' : (s > 0 ? 'surplus-pos' : 'surplus-zero'));
	}

	const totalSurplus = state.products.reduce((sum, p) => sum + actualSurplusQty(p), 0);
	const totalSurplusEl = document.getElementById('totalActualSurplusVal');
	if (totalSurplusEl) {
		totalSurplusEl.textContent = (totalSurplus > 0 ? '+' : '') + totalSurplus;
		totalSurplusEl.className = 'summary-val ' + (totalSurplus < 0 ? 'surplus-neg' : '');
	}
}

function updateActualColdroom(idx, val) {
	state.products[idx].actualColdroom = (val === '' || val === null) ? null : (parseInt(val) || 0);

	const s = actualSurplusQty(state.products[idx]);
	const surplusEl = document.getElementById(`actualSurplus_${idx}`);
	if (surplusEl) {
		surplusEl.textContent = (s > 0 ? '+' : '') + s;
		surplusEl.className = 'surplus-qty ' + (s < 0 ? 'surplus-neg' : (s > 0 ? 'surplus-pos' : 'surplus-zero'));
	}

	const totalSurplus = state.products.reduce((sum, p) => sum + actualSurplusQty(p), 0);
	const totalSurplusEl = document.getElementById('totalActualSurplusVal');
	if (totalSurplusEl) {
		totalSurplusEl.textContent = (totalSurplus > 0 ? '+' : '') + totalSurplus;
		totalSurplusEl.className = 'summary-val ' + (totalSurplus < 0 ? 'surplus-neg' : '');
	}
}

async function saveActuals() {
	if (!confirm(`Save actual production for ${state.date}?\n\n${state.products.length} items.`)) return;

	showToast('💾 Saving...', '');

	const rows = state.products.map(p => ({
		code: p.code,
		name: p.name,
		plannedQty: p.plannedQty,
		actualQty: p.actualQty || 0
	}));

	// Anything entered in the new COLDROOM column is a batch that was cooked today but not
	// packed (going into the fridge for tomorrow instead) — add it onto whatever Coldroom
	// stock the product already has, so tomorrow's Plan screen picks it up automatically
	// without Alex having to remember to re-enter it there too.
	const coldroomAdditions = state.products
		.map(p => ({ p, add: p.actualColdroom || 0 }))
		.filter(x => x.add > 0);
	const coldroomStockRows = coldroomAdditions.map(x => ({
		code: x.p.code,
		qty: x.p.stockQty || 0,
		coldroomQty: (x.p.coldroomQty || 0) + x.add
	}));

	try {
		const requests = [
			fetch(SCRIPT_URL, {
				method: 'POST',
				headers: {'Content-Type': 'text/plain'},
				body: JSON.stringify({
					action: 'writeProductionLog',
					sheetId: NEW_SHEET_ID,
					date: state.date,
					rows: rows
				})
			})
		];
		if (coldroomStockRows.length > 0) {
			requests.push(fetch(SCRIPT_URL, {
				method: 'POST',
				headers: {'Content-Type': 'text/plain'},
				body: JSON.stringify({
					action: 'updateStockLevels',
					sheetId: NEW_SHEET_ID,
					rows: coldroomStockRows
				})
			}));
		}
		const responses = await Promise.all(requests);
		const data = await responses[0].json();
		if (data.status === 'ok') {
			// Reflect the forwarded Coldroom addition in local state immediately, so the
			// numbers are right if Alex flips back to the PLAN tab without reloading.
			coldroomAdditions.forEach(x => { x.p.coldroomQty = (x.p.coldroomQty || 0) + x.add; });
			showToast(`✅ Saved ${data.saved} items` + (coldroomStockRows.length > 0 ? ' + coldroom stock updated' : ''), 'success');
		} else {
			showToast('⚠️ ' + (data.message || 'Save failed'), 'error');
		}
	} catch (e) {
		showToast('⚠️ Network error — try again', 'error');
	}
}
