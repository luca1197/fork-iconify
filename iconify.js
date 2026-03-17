const canvas = document.querySelector('canvas#render');
const height = document.querySelector('input[name="height"]');
const width = document.querySelector('input[name="width"]');
const colorSelect = document.querySelector('select[name="color"]');
const customColor = document.querySelector('input[name="custom-color"]');
const withManifest = document.querySelector('input[name="manifest"]');
const extendedManifest = document.querySelector('input[name="extended"]');
const manifestFormat = document.querySelector('select[name="manifest-format"]');
const files = document.querySelector('input[type="file"]');
const outputNameInput = document.querySelector('input[name="output-name"]');

const RE_STRIP_EXTENSION = /^(.*?)(\.[^.]*?)?$/;
function stripExtension(fileName) {
	return fileName.replace(RE_STRIP_EXTENSION, '$1');
}
function pngExtension(fileName) {
	return stripExtension(fileName) + '.png';
}

function colorLabel(colorValue) {
	if (!colorValue) return 'original';
	if (colorValue === '#000000') return 'black';
	if (colorValue === '#ffffff') return 'white';
	return colorValue.replace(/^#/, '');
}

// Resolves the output filename (without .png extension) from the user-supplied template.
// Supported placeholders: {name}, {width}, {height}, {size}, {color}
// defaultTemplate is used when the user leaves the field blank.
function resolveOutputName(baseName, w, h, colorValue, defaultTemplate = '{name}') {
	const template = outputNameInput.value.trim() || defaultTemplate;
	const sizeStr = w != null && h != null ? `${w}x${h}` : String(w ?? h ?? '');
	const result = template
		.replace(/\{name\}/g, baseName)
		.replace(/\{width\}/g, w != null ? String(w) : '')
		.replace(/\{height\}/g, h != null ? String(h) : '')
		.replace(/\{color\}/g, colorLabel(colorValue))
		.replace(/\{size\}/g, sizeStr);
	return result || baseName;
}

function recolorSVG(svg, color) {
	for (let i = 0; i < svg.children.length; i++) {
		const child = svg.children[i];
		if (typeof child.isPointInFill === 'function') {
			child.setAttribute('fill', color);
			child.style.fill = null;
		}
		recolorSVG(child, color);
	}
}

function render(file, width, height, color, manifest, manifestKey) {
	return new Promise(finish => {
		// Read the SVG
		const reader = new FileReader();
		reader.onload = function(e) {
			const svg = document.adoptNode(new DOMParser().parseFromString(e.target.result, 'image/svg+xml').children[0]);

			// Render the SVG
			document.body.appendChild(svg);
			
			// Fit the SVG
			var bbox = svg.getBBox();
			svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);

			if (width) svg.setAttribute('width', width);
			if (height) svg.setAttribute('height', height);

			// Size the canvas appropriately
			canvas.width = Number(svg.getAttribute('width'));
			canvas.style.width = canvas.width + 'px';
			canvas.height = Number(svg.getAttribute('height'));
			canvas.style.height = canvas.height + 'px';

			// Add to manifest
			if (manifest) {
				var bbox = svg.getBBox();
				const ctm = svg.getCTM();

				let xy = svg.createSVGPoint();
				xy.x = bbox.x;
				xy.y = bbox.y;
				xy = xy.matrixTransform(ctm);

				let wh = svg.createSVGPoint();
				wh.x = bbox.width;
				wh.y = bbox.height;
				wh = wh.matrixTransform(ctm);

				var bbox = {
					width: Math.round(wh.x),
					height: Math.round(wh.y),
					left: Math.round(xy.x),
					top: Math.round(xy.y)
				};

				manifest[manifestKey || stripExtension(file.name)] = extendedManifest.checked ? {
					color,
					width: Math.round(canvas.width),
					height: Math.round(canvas.height),
					bbox,
				} : bbox;
			}

			// Recolor the SVG
			if (color) recolorSVG(svg, color);

			// Create a blob of the SVG
			const blob = new Blob([svg.outerHTML], {type: 'image/svg+xml'});

			// Remove the SVG
			svg.remove();

			// Create the Image
			const img = new Image();
			const blobUrl = URL.createObjectURL(blob);
			img.onload = function() {
				const ctx = canvas.getContext('2d');
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(blobUrl);
				
				// Create a PNG from the canvas
				const imageData = canvas.toDataURL('image/png').substr('data:image/png;base64,'.length);
				finish(imageData);
			};
			img.src = blobUrl;
		};
		reader.readAsBinaryString(file);
	});
}

async function iconify(file, width, height, color) {
	// Render SVG and get PNG Base64
	const imageData = await render(file, width, height, color);

	// Convert Base64 to Blob
	const blob = new Blob([base64DecToArr(imageData)], {type: 'image/png'});

	// Save blob
	const outName = resolveOutputName(stripExtension(file.name), width, height, color);
	saveAs(blob, outName + '.png');
}

async function iconifyZIP(files, width, height, color, manifest) {
	const zip = new JSZip();

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const baseName = stripExtension(file.name);
		const outName = resolveOutputName(baseName, width, height, color);

		// Render SVG and get PNG Base64
		const imageData = await render(file, width, height, color, manifest, outName);

		// Add it to the ZIP (outName may contain slashes to create subfolders)
		zip.file(outName + '.png', imageData, {base64: true});
	}

	if (manifest) zip.file('manifest.' + manifestFormat.value, stringifyManifest(manifest));

	saveAs(await zip.generateAsync({type: 'blob'}), 'iconify.zip');
}

function formUpdate() {
	if (height.value.length === 0)
		height.setAttribute('placeholder', width.value.length > 0 ? width.value : width.getAttribute('placeholder'));
	
	if (colorSelect.value === 'custom') {
		customColor.style.display = 'initial';
		customColor.required = true;
	} else {
		customColor.style.display = 'none';
		customColor.required = false;
	}
}

// === Preset System ===

const PRESET_STORAGE_KEY = 'iconify_presets';

const DEFAULT_PRESETS = [
	{ name: 'White 16\u00d716', color: 'white', customColor: '#000000', width: '16', height: '16', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'White 32\u00d732', color: 'white', customColor: '#000000', width: '32', height: '32', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'White 64\u00d764', color: 'white', customColor: '#000000', width: '64', height: '64', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'White 128\u00d7128', color: 'white', customColor: '#000000', width: '128', height: '128', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'Black 16\u00d716', color: 'black', customColor: '#000000', width: '16', height: '16', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'Black 32\u00d732', color: 'black', customColor: '#000000', width: '32', height: '32', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'Black 64\u00d764', color: 'black', customColor: '#000000', width: '64', height: '64', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
	{ name: 'Black 128\u00d7128', color: 'black', customColor: '#000000', width: '128', height: '128', manifest: false, extended: false, manifestFormat: 'json', multiSize: false, sizes: [], zipDownload: true, outputName: '' },
];

function getUserPresets() {
	try {
		const raw = localStorage.getItem(PRESET_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveUserPresets(presets) {
	try {
		localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
	} catch {
		alert('Failed to save presets: storage may be full.');
	}
}

function populatePresetSelect() {
	const select = document.getElementById('preset-select');
	select.innerHTML = '';

	const placeholder = document.createElement('option');
	placeholder.value = '';
	placeholder.textContent = '\u2014 Select preset \u2014';
	select.appendChild(placeholder);

	const defaultGroup = document.createElement('optgroup');
	defaultGroup.label = 'Defaults';
	DEFAULT_PRESETS.forEach((p, i) => {
		const opt = document.createElement('option');
		opt.value = 'default_' + i;
		opt.textContent = p.name;
		defaultGroup.appendChild(opt);
	});
	select.appendChild(defaultGroup);

	const userPresets = getUserPresets();
	if (userPresets.length > 0) {
		const customGroup = document.createElement('optgroup');
		customGroup.label = 'Custom';
		userPresets.forEach((p, i) => {
			const opt = document.createElement('option');
			opt.value = 'custom_' + i;
			opt.textContent = p.name;
			customGroup.appendChild(opt);
		});
		select.appendChild(customGroup);
	}
}

function getFormState() {
	return {
		color: colorSelect.value,
		customColor: customColor.value,
		width: width.value,
		height: height.value,
		manifest: withManifest.checked,
		extended: extendedManifest.checked,
		manifestFormat: manifestFormat.value,
		multiSize: document.getElementById('multi-size').checked,
		sizes: getSizes(),
		zipDownload: document.getElementById('zip-download').checked,
		outputName: outputNameInput.value,
	};
}

function applyFormState(state) {
	colorSelect.value = state.color || '';
	customColor.value = state.customColor || '#000000';
	width.value = state.width || '';
	height.value = state.height || '';
	withManifest.checked = !!state.manifest;
	extendedManifest.checked = !!state.extended;
	manifestFormat.value = state.manifestFormat || 'json';
	document.getElementById('multi-size').checked = !!state.multiSize;
	toggleMultiSize();
	const tbody = document.getElementById('sizes-body');
	tbody.replaceChildren();
	if (state.sizes && state.sizes.length > 0) {
		state.sizes.forEach(s => addSizeRow(s.width, s.height));
	}
	document.getElementById('zip-download').checked = state.zipDownload !== false;
	outputNameInput.value = state.outputName || '';
	formUpdate();
}

function loadPreset() {
	const select = document.getElementById('preset-select');
	if (!select.value) return;

	const [type, indexStr] = select.value.split('_');
	const index = parseInt(indexStr, 10);
	const preset = type === 'default' ? DEFAULT_PRESETS[index] : getUserPresets()[index];
	if (preset) applyFormState(preset);
}

function savePreset() {
	const nameInput = document.getElementById('preset-name');
	const name = nameInput.value.trim();
	if (!name) {
		alert('Enter a preset name.');
		return;
	}

	const presets = getUserPresets();
	const state = getFormState();
	state.name = name;

	const existing = presets.findIndex(p => p.name === name);
	if (existing >= 0) {
		presets[existing] = state;
	} else {
		presets.push(state);
	}

	saveUserPresets(presets);
	populatePresetSelect();
	nameInput.value = '';
}

function deletePreset() {
	const select = document.getElementById('preset-select');
	if (!select.value) return;

	const [type, indexStr] = select.value.split('_');
	if (type === 'default') {
		alert('Cannot delete default presets.');
		return;
	}

	const index = parseInt(indexStr, 10);
	const presets = getUserPresets();
	const preset = presets[index];
	if (!preset) return;

	if (!confirm('Delete preset "' + preset.name + '"?')) return;

	const deleteIndex = presets.findIndex(p => p.name === preset.name);
	if (deleteIndex >= 0) presets.splice(deleteIndex, 1);
	saveUserPresets(presets);
	populatePresetSelect();
}

// === Multi-Size System ===

function toggleMultiSize() {
	const enabled = document.getElementById('multi-size').checked;
	document.getElementById('width-row').style.display = enabled ? 'none' : '';
	document.getElementById('height-row').style.display = enabled ? 'none' : '';
	document.getElementById('size-list').style.display = enabled ? '' : 'none';
}

function addSizeRow(w = '', h = '') {
	w = w === '' ? '' : Number(w) || '';
	h = h === '' ? '' : Number(h) || '';

	const tbody = document.getElementById('sizes-body');
	const row = document.createElement('tr');

	const wTd = document.createElement('td');
	const wInput = document.createElement('input');
	wInput.type = 'number';
	wInput.className = 'size-w';
	wInput.value = w;
	wInput.min = '1';
	wInput.placeholder = 'W';
	wTd.appendChild(wInput);

	const sepTd = document.createElement('td');
	sepTd.textContent = '\u00d7';

	const hTd = document.createElement('td');
	const hInput = document.createElement('input');
	hInput.type = 'number';
	hInput.className = 'size-h';
	hInput.value = h;
	hInput.min = '1';
	hInput.placeholder = 'H';
	hTd.appendChild(hInput);

	const btnTd = document.createElement('td');
	const removeBtn = document.createElement('button');
	removeBtn.type = 'button';
	removeBtn.textContent = '\u00d7';
	removeBtn.onclick = () => row.remove();
	btnTd.appendChild(removeBtn);

	row.append(wTd, sepTd, hTd, btnTd);
	tbody.appendChild(row);
}

function getSizes() {
	return Array.from(document.querySelectorAll('#sizes-body tr')).map(row => {
		const w = Number(row.querySelector('.size-w').value);
		const h = Number(row.querySelector('.size-h').value);
		return { width: w > 0 ? w : null, height: h > 0 ? h : null };
	}).filter(s => s.width || s.height);
}

async function iconifyMultiSize(fileList, sizes, color, manifest, useZip) {
	if (useZip) {
		const zip = new JSZip();

		for (const size of sizes) {
			const w = size.width || size.height;
			const h = size.height || size.width;

			for (let i = 0; i < fileList.length; i++) {
				const file = fileList[i];
				const baseName = stripExtension(file.name);
				const outName = resolveOutputName(baseName, w, h, color, '{name}_{width}x{height}');
				const imageData = await render(file, w, h, color, manifest, outName);
				zip.file(outName + '.png', imageData, { base64: true });
			}
		}

		if (manifest) zip.file('manifest.' + manifestFormat.value, stringifyManifest(manifest));
		saveAs(await zip.generateAsync({ type: 'blob' }), 'iconify.zip');
	} else {
		for (const size of sizes) {
			const w = size.width || size.height;
			const h = size.height || size.width;

			for (let i = 0; i < fileList.length; i++) {
				const file = fileList[i];
				const baseName = stripExtension(file.name);
				const outName = resolveOutputName(baseName, w, h, color, '{name}_{width}x{height}');
				const imageData = await render(file, w, h, color, manifest, outName);
				const blob = new Blob([base64DecToArr(imageData)], { type: 'image/png' });
				saveAs(blob, outName + '.png');
				await new Promise(r => setTimeout(r, 100));
			}
		}

		if (manifest) {
			await new Promise(r => setTimeout(r, 100));
			const manifestBlob = new Blob([stringifyManifest(manifest)], { type: 'text/plain' });
			saveAs(manifestBlob, 'manifest.' + manifestFormat.value);
		}
	}
}

// === Init ===

populatePresetSelect();
formUpdate();

function resolveColor() {
	switch (colorSelect.value) {
		case 'custom': return customColor.value;
		case 'black':  return '#000000';
		case 'white':  return '#ffffff';
		default:       return undefined;
	}
}

function iconifySubmit(e) {
	e.preventDefault();
	e.stopPropagation();

	const color = resolveColor();
	const multiSizeEnabled = document.getElementById('multi-size').checked;

	if (multiSizeEnabled) {
		const sizes = getSizes();
		if (sizes.length === 0) {
			alert('Add at least one size.');
			return false;
		}
		const useZip = document.getElementById('zip-download').checked;
		const manifest = withManifest.checked ? {} : undefined;
		iconifyMultiSize(files.files, sizes, color, manifest, useZip);
	} else {
		const desiredWidth = width.value.length > 0 ? width.value : null;
		const desiredHeight = height.value.length > 0 ? Number(height.value) : desiredWidth;

		if (files.files.length === 1 && !withManifest.checked)
			iconify(files.files[0], desiredWidth, desiredHeight, color);
		else
			iconifyZIP(files.files, desiredWidth, desiredHeight, color, withManifest.checked ? {} : undefined);
	}

	return false;
}

function stringifyManifest(manifest) {
	switch (manifestFormat.value) {
		case 'json':
			return JSON.stringify(manifest);

		case 'lua': {
			function luaKV(tbl) {
				let lua = '{';

				for (const k in tbl) {
					const v = tbl[k];
					switch (typeof v) {
						case 'object':
							lua += k + '=' + luaKV(v);
							break;
						
						case 'null':
						case 'undefined':
							continue;

						case 'string':
							lua += k + '=\"' + v + '\"';
							break;

						default:
							lua += k + '=' + v;
					}
					lua += ',';
				}
				
				lua = lua.substr(0, lua.length - 1) + '}';
				return lua;
			}

			let lua = '{';
			for (const file in manifest) {
				lua += '["' + file + '"]=' + luaKV(manifest[file]) + ',';
			}
			lua = lua.substr(0, lua.length - 1) + '}';
			return lua;
		}
	}
}