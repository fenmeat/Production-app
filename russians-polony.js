function buildTrolleyCardHTML(rt, coldroomBatches) {
	if (!rt || rt.totalLoose <= 0) {
		return `
			<div class="trolley-title">🥩 Russians Trolley (R6 / R5 / R4 / R3)</div>
			<div class="trolley-row"><span>✅ Stock already covers today's need — nothing to cook</span></div>
		`;
	}
	const coldroomNeedsInput = !(coldroomBatches > 0);
	return `
		<div class="trolley-title">🥩 Russians Trolley (R6 / R5 / R4 / R3)</div>
		<div class="trolley-row"><span>Needed today</span><b id="rt-needed">${rt.totalLoose.toLocaleString()}</b></div>
		<div class="trolley-coldroom-input">
			<span>In coldroom now <small>(1 batch = ${RUSSIAN_BATCH_YIELD.toLocaleString()} loose)</small></span>
			<input type="number" class="qty-input${coldroomNeedsInput ? ' needs-input' : ''}" id="russianColdroomInput" value="${coldroomBatches || 0}" min="0" step="0.5"
				oninput="updateRussianColdroomBatches(this.value)" onfocus="this.select()">
		</div>
		<div class="trolley-row"><span>From coldroom</span><b id="rt-from-coldroom">${rt.coldroomLoose.toLocaleString()}</b></div>
		<div class="trolley-row"><span>New batches to cook</span><b id="rt-new-batches">${rt.batchesNeeded}</b></div>
		<div class="trolley-row"><span>Total available</span><b id="rt-total-available">${rt.looseAvailable.toLocaleString()}</b></div>
		<div class="trolley-split">
			<div><span>R6</span><b id="rt-split-r01">${rt.suggestedBags.R01}</b></div>
			<div><span>R5</span><b id="rt-split-r02">${rt.suggestedBags.R02}</b></div>
			<div><span>R4</span><b id="rt-split-r03">${rt.suggestedBags.R03}</b></div>
			<div><span>R3</span><b id="rt-split-r04">${rt.suggestedBags.R04}</b></div>
		</div>
		<div id="rt-extra-section">${buildRussianExtraSectionHTML(rt)}</div>
	`;
}

function buildRussianExtraSectionHTML(rt) {
	const extra = calcRussianExtraCapacity(rt);
	if (extra.remainingLoose < 0) {
		return `
			<div class="trolley-extra trolley-extra-over">
				<div class="trolley-extra-title">⚠️ Not enough for your Produce numbers</div>
				<div class="trolley-row"><span>Short by</span><b class="surplus-neg">${Math.abs(extra.remainingLoose).toLocaleString()} loose</b></div>
				<div class="trolley-extra-note">Lower a Produce number above, or add Coldroom batches.</div>
			</div>
		`;
	}
	return `
		<div class="trolley-extra">
			<div class="trolley-extra-title">📦 Extra after today's plan</div>
			<div class="trolley-row"><span>Left over</span><b>${extra.remainingLoose.toLocaleString()}</b></div>
			${extra.remainingLoose > 0 ? `
				<div class="trolley-extra-note">Could also make (using it all on one size):</div>
				<div class="trolley-split">
					<div><span>R6</span><b>+${extra.maxExtra.R01}</b></div>
					<div><span>R5</span><b>+${extra.maxExtra.R02}</b></div>
					<div><span>R4</span><b>+${extra.maxExtra.R03}</b></div>
					<div><span>R3</span><b>+${extra.maxExtra.R04}</b></div>
				</div>
			` : ''}
		</div>
	`;
}

// How many loose Russians remain once Alex's actual chosen Produce numbers (including any
// manual overrides) for R6/R5/R4/R3 are accounted for — separate from rt.leftoverLoose, which
// only reflects the auto-suggested allocation's unavoidable rounding waste.
function calcRussianExtraCapacity(rt) {
	let totalChosenLoose = 0;
	RUSSIAN_CODES.forEach(code => {
		const p = state.products.find(pr => pr.code === code);
		if (p) totalChosenLoose += displayProduce(p) * RUSSIAN_PER_BAG[code];
	});
	const remainingLoose = rt.looseAvailable - totalChosenLoose;
	const maxExtra = {};
	RUSSIAN_CODES.forEach(code => {
		maxExtra[code] = remainingLoose > 0 ? Math.floor(remainingLoose / RUSSIAN_PER_BAG[code]) : 0;
	});
	return { totalChosenLoose, remainingLoose, maxExtra };
}

function calcRussiansTrolley(products, coldroomBatches) {
	coldroomBatches = coldroomBatches || 0;
	const needLoose = {};
	let totalLoose = 0;
	RUSSIAN_CODES.forEach(code => {
		const p = products.find(pr => pr.code === code);
		// Fix (31 July 2026): if Alex has manually typed a Produce number for this size
		// (e.g. wants to cook extra buffer stock even though Stock/Coldroom already cover
		// the route need), that override now drives the pooled trolley's requirement —
		// previously this always used the calculated need and ignored any override, so
		// "Batches required to cook today" never moved no matter what Alex typed.
		const hasOverride = p && p.produceOverride !== null && p.produceOverride !== undefined;
		const bagsNeeded = p ? (hasOverride ? p.produceOverride : rawNeed(p)) : 0;
		const loose = bagsNeeded * RUSSIAN_PER_BAG[code];
		needLoose[code] = loose;
		totalLoose += loose;
	});

	const coldroomLoose = coldroomBatches * RUSSIAN_BATCH_YIELD;
	const shortfall = Math.max(0, totalLoose - coldroomLoose);
	const batchesNeededCount = shortfall <= 0 ? 0 : Math.ceil(shortfall / RUSSIAN_BATCH_YIELD);
	const newLoose = batchesNeededCount * RUSSIAN_BATCH_YIELD;
	const looseAvailable = coldroomLoose + newLoose;

	// Every size gets at least enough whole bags to cover its own need — never shortchanged
	// just because it happens to be processed last. (Old approach: R6/R5/R4 rounded up
	// individually, then R4 only got "whatever's left" — the cumulative rounding from the
	// other three could eat into R4's own share, showing a false shortage even though the
	// pool overall always has enough.)
	const suggestedBags = {};
	RUSSIAN_CODES.forEach(code => {
		suggestedBags[code] = needLoose[code] > 0 ? Math.ceil(needLoose[code] / RUSSIAN_PER_BAG[code]) : 0;
	});
	let allocated = RUSSIAN_CODES.reduce((s, code) => s + suggestedBags[code] * RUSSIAN_PER_BAG[code], 0);

	// Rare edge case: rounding every size up individually asks for slightly more loose than
	// is actually available. Trim 1 bag at a time from the largest bag size first (frees the
	// most loose per bag removed, so it takes the fewest trims and causes least disruption).
	if (allocated > looseAvailable) {
		const byBagSizeDesc = [...RUSSIAN_CODES].sort((a, b) => RUSSIAN_PER_BAG[b] - RUSSIAN_PER_BAG[a]);
		let over = allocated - looseAvailable;
		for (const code of byBagSizeDesc) {
			while (over > 0 && suggestedBags[code] > 0) {
				suggestedBags[code] -= 1;
				allocated -= RUSSIAN_PER_BAG[code];
				over -= RUSSIAN_PER_BAG[code];
			}
			if (over <= 0) break;
		}
	}

	const leftoverLoose = Math.max(0, looseAvailable - allocated);

	return { needLoose, totalLoose, coldroomLoose, batchesNeeded: batchesNeededCount, looseAvailable, suggestedBags, leftoverLoose };
}

function calcPolonyPlan(products) {
	const plan = {};
	POLONY_CODES.forEach(code => {
		const p = products.find(pr => pr.code === code);
		const bagsNeeded = p ? p.plannedQty : 0;
		const packedStock = p ? (p.stockQty || 0) : 0;
		const casingsOnTrolley = p ? (p.coldroomQty || 0) : 0;
		const bagsPerCasing = POLONY_BAGS_PER_CASING[code];

		// Stage 1: net off already-packed finished bags
		const netBagsNeeded = Math.max(0, bagsNeeded - packedStock);

		// Stage 2: cover the remainder from coldroom casings, then cook if still short
		const bagsAvailable = casingsOnTrolley * bagsPerCasing;
		const shortfall = netBagsNeeded - bagsAvailable;
		const casingsToMake = shortfall > 0 ? Math.ceil(shortfall / bagsPerCasing) : 0;
		const pakUitTrolley = Math.min(bagsAvailable, netBagsNeeded);
		const nuutTePak = Math.max(0, netBagsNeeded - bagsAvailable);
		const surplusToTrolley = (casingsToMake * bagsPerCasing) - nuutTePak;
		plan[code] = { bagsNeeded, packedStock, netBagsNeeded, casingsOnTrolley, bagsAvailable, casingsToMake, pakUitTrolley, nuutTePak, surplusToTrolley };
	});
	return plan;
}

function buildPolonyCardHTML(plan) {
	if (!plan || POLONY_CODES.every(c => !plan[c] || plan[c].bagsNeeded === 0)) return '';
	const row = (label, fn) => `
		<div class="pc-row">
			<div class="pc-label">${label}</div>
			${POLONY_CODES.map(c => `<div class="pc-val">${plan[c] ? fn(plan[c]) : '—'}</div>`).join('')}
		</div>`;
	const polonyProduct = c => state.products.find(pr => pr.code === c);
	const totalAvailable = c => {
		const d = plan[c]; const p = polonyProduct(c);
		if (!d || !p) return 0;
		return d.packedStock + d.bagsAvailable + displayProduce(p);
	};
	return `
		<div class="polony-title">🧀 Polony Pack Plan — each product is independent</div>
		<div class="pc-header">
			<div class="pc-label"></div>
			<div class="pc-val"><b>SMALL</b><br><small>P02</small></div>
			<div class="pc-val"><b>MED</b><br><small>P03</small></div>
			<div class="pc-val"><b>LONG</b><br><small>P04</small></div>
		</div>
		${row('Bags needed', d => d.bagsNeeded)}
		${row('Packed stock', d => d.packedStock)}
		${row('Net bags needed', d => d.netBagsNeeded)}
		<div class="pc-divider"></div>
		${row('Casings on trolley', d => d.casingsOnTrolley)}
		${row('Bags from trolley', d => d.bagsAvailable)}
		<div class="pc-divider"></div>
		${row('Casings to cook', d => `<b class="${d.casingsToMake > 0 ? 'pc-cook' : 'pc-ok'}">${d.casingsToMake > 0 ? d.casingsToMake : '✅ 0'}</b>`)}
		${row('Pack from trolley', d => d.pakUitTrolley)}
		${row('Pack from new', d => d.nuutTePak)}
		${row('Surplus → trolley', d => d.surplusToTrolley > 0 ? `+${d.surplusToTrolley}` : '0')}
		<div class="pc-divider"></div>
		<div class="pc-row pc-row-highlight">
			<div class="pc-label">Total available<br><small>packed + trolley + new</small></div>
			${POLONY_CODES.map(c => `<div class="pc-val"><b>${totalAvailable(c)}</b></div>`).join('')}
		</div>
		<div class="pc-row pc-row-highlight">
			<div class="pc-label">Surplus vs Forecast</div>
			${POLONY_CODES.map(c => {
				const d = plan[c]; if (!d) return '<div class="pc-val">—</div>';
				const s = totalAvailable(c) - d.bagsNeeded;
				const cls = s < 0 ? 'surplus-neg' : (s > 0 ? 'surplus-pos' : 'surplus-zero');
				return `<div class="pc-val ${cls}"><b>${s > 0 ? '+' : ''}${s}</b></div>`;
			}).join('')}
		</div>
		<div class="polony-note">P01 Pizza Toppings = trimmings &amp; offcuts only — pack what yields, no target</div>
		<div class="pc-divider"></div>
		${buildPolonyTrolleyBuilderHTML(state.polonyTrolleys, plan)}
	`;
}

function calcPolonyTrolleyRow(row) {
	const bagsSmall = (row.small || 0) * POLONY_BAGS_PER_CASING.P02;
	const bagsMed = (row.med || 0) * POLONY_BAGS_PER_CASING.P03;
	const bagsLong = (row.long || 0) * POLONY_BAGS_PER_CASING.P04;
	const totalCasings = (row.small || 0) + (row.med || 0) + (row.long || 0);
	const totalBags = bagsSmall + bagsMed + bagsLong;
	const over = totalCasings > POLONY_TROLLEY_CAPACITY;
	return { bagsSmall, bagsMed, bagsLong, totalCasings, totalBags, over };
}

function buildDefaultPolonyTrolleys(plan) {
	let small = plan.P02 ? plan.P02.casingsToMake : 0;
	let med = plan.P03 ? plan.P03.casingsToMake : 0;
	let long = plan.P04 ? plan.P04.casingsToMake : 0;
	const trolleys = [];
	while (small > 0 || med > 0 || long > 0) {
		let remaining = POLONY_TROLLEY_CAPACITY;
		const t = { small: 0, med: 0, long: 0 };
		const takeSmall = Math.min(small, remaining); t.small = takeSmall; small -= takeSmall; remaining -= takeSmall;
		const takeMed = Math.min(med, remaining); t.med = takeMed; med -= takeMed; remaining -= takeMed;
		const takeLong = Math.min(long, remaining); t.long = takeLong; long -= takeLong; remaining -= takeLong;
		trolleys.push(t);
	}
	return trolleys;
}

function buildPolonyTrolleyBuilderHTML(trolleys, plan) {
	trolleys = trolleys || [];
	const assignedSmall = trolleys.reduce((s, t) => s + (t.small || 0), 0);
	const assignedMed = trolleys.reduce((s, t) => s + (t.med || 0), 0);
	const assignedLong = trolleys.reduce((s, t) => s + (t.long || 0), 0);
	const neededSmall = plan.P02 ? plan.P02.casingsToMake : 0;
	const neededMed = plan.P03 ? plan.P03.casingsToMake : 0;
	const neededLong = plan.P04 ? plan.P04.casingsToMake : 0;

	const progressRow = (label, id, assigned, needed) => `
		<div class="pt-progress-row">
			<span>${label}</span>
			<b class="${assigned >= needed ? 'pc-ok' : 'pc-cook'}" id="${id}">${assigned} / ${needed} casings</b>
		</div>`;

	const rows = trolleys.map((t, i) => {
		const calc = calcPolonyTrolleyRow(t);
		return `
			<div class="pt-row ${calc.over ? 'pt-row-over' : ''}" id="pt-row-${i}">
				<div class="pt-num">${i + 1}</div>
				<div class="pt-input-group">
					<label>Small</label>
					<input type="number" class="pt-input" min="0" step="0.5" value="${t.small || 0}" oninput="updatePolonyTrolley(${i}, 'small', this.value)" onfocus="this.select()">
					<span class="pt-bags" id="pt-bags-small-${i}">${calc.bagsSmall} bags</span>
				</div>
				<div class="pt-input-group">
					<label>Med</label>
					<input type="number" class="pt-input" min="0" step="0.5" value="${t.med || 0}" oninput="updatePolonyTrolley(${i}, 'med', this.value)" onfocus="this.select()">
					<span class="pt-bags" id="pt-bags-med-${i}">${calc.bagsMed} bags</span>
				</div>
				<div class="pt-input-group">
					<label>Long</label>
					<input type="number" class="pt-input" min="0" step="0.5" value="${t.long || 0}" oninput="updatePolonyTrolley(${i}, 'long', this.value)" onfocus="this.select()">
					<span class="pt-bags" id="pt-bags-long-${i}">${calc.bagsLong} bags</span>
				</div>
				<div class="pt-total" id="pt-total-${i}">
					${calc.totalCasings}/${POLONY_TROLLEY_CAPACITY}
					<div class="pt-status" id="pt-status-${i}">${calc.over ? `🚫 ${calc.totalCasings - POLONY_TROLLEY_CAPACITY} too many` : '✔ OK'}</div>
				</div>
				<div class="tp-remove no-print" onclick="removePolonyTrolley(${i})" title="Remove trolley">✕</div>
			</div>
		`;
	}).join('');

	return `
		<div class="pt-title">🧊 Polony Trolley Builder <small>(max ${POLONY_TROLLEY_CAPACITY} casings per trolley)</small></div>
		<div class="pt-progress">
			${progressRow('Small (P02)', 'pt-progress-small', assignedSmall, neededSmall)}
			${progressRow('Med (P03)', 'pt-progress-med', assignedMed, neededMed)}
			${progressRow('Long (P04)', 'pt-progress-long', assignedLong, neededLong)}
		</div>
		<div class="pt-header">
			<div>#</div><div>SMALL</div><div>MED</div><div>LONG</div><div>CASINGS</div>
		</div>
		${rows || '<div class="tp-req-row"><span>No trolleys yet — add one below</span></div>'}
		<div class="tp-actions no-print">
			<button class="tp-btn" onclick="addPolonyTrolley()">+ Add Trolley</button>
			<button class="tp-btn tp-btn-reset" onclick="resetPolonyTrolleys()">↺ Reset to Auto-Fill</button>
			<button class="tp-btn tp-btn-save" onclick="saveTrolleyLayout()">💾 Save Layout</button>
		</div>
	`;
}

function refreshPolonyCard() {
	const polonyEl = document.getElementById('polonyCard');
	if (polonyEl) polonyEl.innerHTML = buildPolonyCardHTML(state.polonyPlan);
}

// Updates one Polony Trolley Builder cell WITHOUT re-rendering the whole card — a full
// innerHTML replace on every keystroke was destroying and recreating the input element,
// which threw away focus after each character and made the field feel uneditable.
function updatePolonyTrolley(rowIdx, sizeKey, value) {
	if (!state.polonyTrolleys[rowIdx]) return;
	state.polonyTrolleys[rowIdx][sizeKey] = parseFloat(value) || 0;

	const t = state.polonyTrolleys[rowIdx];
	const calc = calcPolonyTrolleyRow(t);

	const bagsSmallEl = document.getElementById(`pt-bags-small-${rowIdx}`);
	if (bagsSmallEl) bagsSmallEl.textContent = calc.bagsSmall + ' bags';
	const bagsMedEl = document.getElementById(`pt-bags-med-${rowIdx}`);
	if (bagsMedEl) bagsMedEl.textContent = calc.bagsMed + ' bags';
	const bagsLongEl = document.getElementById(`pt-bags-long-${rowIdx}`);
	if (bagsLongEl) bagsLongEl.textContent = calc.bagsLong + ' bags';

	const totalEl = document.getElementById(`pt-total-${rowIdx}`);
	if (totalEl) {
		totalEl.childNodes[0].textContent = `${calc.totalCasings}/${POLONY_TROLLEY_CAPACITY} `;
	}
	const statusEl = document.getElementById(`pt-status-${rowIdx}`);
	if (statusEl) {
		statusEl.textContent = calc.over ? `🚫 ${calc.totalCasings - POLONY_TROLLEY_CAPACITY} too many` : '✔ OK';
	}
	const rowEl = document.getElementById(`pt-row-${rowIdx}`);
	if (rowEl) rowEl.classList.toggle('pt-row-over', calc.over);

	// Refresh the top progress summary (Small/Med/Long assigned-vs-needed) across ALL trolleys
	const plan = state.polonyPlan;
	const assignedSmall = state.polonyTrolleys.reduce((s, tr) => s + (tr.small || 0), 0);
	const assignedMed = state.polonyTrolleys.reduce((s, tr) => s + (tr.med || 0), 0);
	const assignedLong = state.polonyTrolleys.reduce((s, tr) => s + (tr.long || 0), 0);
	const neededSmall = plan.P02 ? plan.P02.casingsToMake : 0;
	const neededMed = plan.P03 ? plan.P03.casingsToMake : 0;
	const neededLong = plan.P04 ? plan.P04.casingsToMake : 0;

	const progEl = document.getElementById('pt-progress-small');
	if (progEl) {
		progEl.textContent = `${assignedSmall} / ${neededSmall} casings`;
		progEl.className = assignedSmall >= neededSmall ? 'pc-ok' : 'pc-cook';
	}
	const progMedEl = document.getElementById('pt-progress-med');
	if (progMedEl) {
		progMedEl.textContent = `${assignedMed} / ${neededMed} casings`;
		progMedEl.className = assignedMed >= neededMed ? 'pc-ok' : 'pc-cook';
	}
	const progLongEl = document.getElementById('pt-progress-long');
	if (progLongEl) {
		progLongEl.textContent = `${assignedLong} / ${neededLong} casings`;
		progLongEl.className = assignedLong >= neededLong ? 'pc-ok' : 'pc-cook';
	}
}

function addPolonyTrolley() {
	state.polonyTrolleys.push({ small: 0, med: 0, long: 0 });
	refreshPolonyCard();
}

function removePolonyTrolley(rowIdx) {
	state.polonyTrolleys.splice(rowIdx, 1);
	refreshPolonyCard();
}

function resetPolonyTrolleys() {
	state.polonyTrolleys = buildDefaultPolonyTrolleys(state.polonyPlan);
	refreshPolonyCard();
}
