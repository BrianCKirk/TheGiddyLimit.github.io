"use strict";

class Counter {
	static $getCounter (board, state) {
		const $wrpPanel = $(`<div class="w-100 h-100 dm-cnt__root dm__data-anchor"/>`) // root class used to identify for saving
			.data("getState", () => counters.getSaveableState());
		const counters = new CounterRoot(board, $wrpPanel);
		counters.setStateFrom(state);
		counters.render($wrpPanel);
		return $wrpPanel;
	}
}

class CounterComponent extends BaseComponent {
	constructor (board, $wrpPanel) {
		super();
		this._board = board;
		this._$wrpPanel = $wrpPanel;
		this._addHookAll("state", () => this._board.doSaveStateDebounced());
	}
}

class CounterRoot extends CounterComponent {
	constructor (board, $wrpPanel) {
		super(board, $wrpPanel);

		this._childComps = [];
		this._$wrpRows = null;
	}

	render ($parent) {
		$parent.empty();

		const pod = this.getPod();

		this._$wrpRows = $$`<div class="flex-col w-100 h-100 overflow-y-auto relative"/>`;
		this._childComps.forEach(it => it.render(this._$wrpRows, pod));

		const $btnAdd = $(`<button class="btn btn-primary btn-xs"><span class="glyphicon glyphicon-plus"/> Add Counter</button>`)
			.click(() => {
				const comp = new CounterRow(this._board, this._$wrpPanel);
				this._childComps.push(comp);
				comp.render(this._$wrpRows, pod);
				this._board.doSaveStateDebounced();
			});

		$$`<div class="w-100 h-100 flex-col px-2 pb-3">
			<div class="no-shrink pt-4"/>
			${this._$wrpRows}
			<div class="no-shrink flex-h-right">${$btnAdd}</div>
		</div>`.appendTo($parent);
	}

	_swapRowPositions (ixA, ixB) {
		const a = this._childComps[ixA];
		this._childComps[ixA] = this._childComps[ixB];
		this._childComps[ixB] = a;

		this._childComps.forEach(it => it.$row.detach().appendTo(this._$wrpRows));

		this._board.doSaveStateDebounced();
	}

	_removeRow (comp) {
		const ix = this._childComps.indexOf(comp);
		if (~ix) {
			this._childComps.splice(ix, 1);
			comp.$row.remove();
			this._board.doSaveStateDebounced();
		}
	}

	getPod () {
		const pod = super.getPod();
		pod.swapRowPositions = this._swapRowPositions.bind(this);
		pod.removeRow = this._removeRow.bind(this);
		pod.counterRows = this._childComps;
		return pod;
	}

	setStateFrom (toLoad) {
		this.setBaseSaveableStateFrom(toLoad);
		this._childComps = [];

		if (toLoad.rowState) {
			toLoad.rowState.forEach(r => {
				const comp = new CounterRow(this._board, this._$wrpPanel);
				comp.setStateFrom(r);
				this._childComps.push(comp);
			});
		}
	}

	getSaveableState () {
		return {
			...this.getBaseSaveableState(),
			rowState: this._childComps.map(r => r.getSaveableState())
		};
	}
}

class CounterRow extends CounterComponent {
	constructor (board, $wrpPanel) {
		super(board, $wrpPanel);

		this._$row = null;
	}

	get $row () { return this._$row; }

	render ($parent, parent) {
		this._parent = parent;

		const $iptName = ComponentUiUtil.$getIptStr(this, "name").addClass("mr-2 small-caps");

		const $iptCur = ComponentUiUtil.$getIptInt(this, "current", 0, {$ele: $(`<input class="form-control input-xs form-control--minimal text-center dm-cnt__ipt dm-cnt__ipt--cur bold">`)});
		const $iptMax = ComponentUiUtil.$getIptInt(this, "max", 0, {$ele: $(`<input class="form-control input-xs form-control--minimal text-center dm-cnt__ipt dm-cnt__ipt--max mr-2 text-muted bold">`)});

		const hookDisplayMinMax = () => {
			$iptCur.removeClass("text-success text-danger");
			if (this._state.current >= this._state.max) $iptCur.addClass("text-success");
			else if (this._state.current <= 0) $iptCur.addClass("text-danger");
		};
		this._addHookBase("current", hookDisplayMinMax);
		this._addHookBase("max", hookDisplayMinMax);
		hookDisplayMinMax();

		const $btnDown = $(`<button class="btn btn-danger btn-xs"><span class="glyphicon glyphicon-minus"/></button>`)
			.click(() => this._state.current--);

		const $btnUp = $(`<button class="btn btn-success btn-xs"><span class="glyphicon glyphicon-plus"/></button>`)
			.click(() => this._state.current++);

		const $btnRemove = $(`<button class="btn btn-danger btn-xxs"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				const {removeRow} = this._parent;
				removeRow(this);
			});

		this._$row = $$`<div class="flex-v-center w-100 my-1">
			${$iptName}
			<div class="relative flex-vh-center">
				${$iptCur}
				<div class="dm-cnt__slash text-muted text-center">/</div>
				${$iptMax}
			</div>
			<div class="flex btn-group mr-2">
				${$btnDown}
				${$btnUp}
			</div>
			${this._render_getDragPad($parent)}
			${$btnRemove}
		</div>`.appendTo($parent);
	}

	_render_getDragPad ($parent) {
		const {swapRowPositions, counterRows} = this._parent;

		const dragMeta = {};
		const doDragCleanup = () => {
			dragMeta.on = false;
			dragMeta.$wrap.remove();
			dragMeta.$dummies.forEach($d => $d.remove());
		};

		const doDragRender = () => {
			if (dragMeta.on) doDragCleanup();

			dragMeta.on = true;
			dragMeta.$wrap = $(`<div class="flex-col ui-drag__wrp-drag-block"/>`).appendTo($parent);
			dragMeta.$dummies = [];

			const ixRow = counterRows.indexOf(this);

			counterRows.forEach((row, i) => {
				const dimensions = {w: row.$row.outerWidth(true), h: row.$row.outerHeight(true)};
				const $dummy = $(`<div class="${i === ixRow ? "ui-drag__wrp-drag-dummy--highlight" : "ui-drag__wrp-drag-dummy--lowlight"}"/>`)
					.width(dimensions.w).height(dimensions.h)
					.mouseup(() => {
						if (dragMeta.on) doDragCleanup();
					})
					.appendTo(dragMeta.$wrap);
				dragMeta.$dummies.push($dummy);

				if (i !== ixRow) { // on entering other areas, swap positions
					$dummy.mouseenter(() => {
						swapRowPositions(i, ixRow);
						doDragRender();
					});
				}
			});
		};

		return $(`<div class="mr-2 ui-drag__patch" title="Drag to Reorder">
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		</div>`).mousedown(() => doDragRender());
	}

	_getDefaultState () { return {...CounterRow._DEFAULT_STATE}; }
}
CounterRow._DEFAULT_STATE = {
	name: "",
	current: 0,
	max: 1
};
