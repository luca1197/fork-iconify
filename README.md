> [!NOTE]
> This is a fork of [WilliamVenner/iconify](https://github.com/WilliamVenner/iconify).

> [!NOTE]
> **AI Usage Disclosure**<br>
> This project is a fork with additional features developed entirely using AI. The app runs 100% locally + offline and does not access any remote data. I believe in being upfront about AI use - feel free to audit the code before use.

# iconify

A browser-based tool for converting SVG files to PNG. Select your files, configure your options, click **Iconify!** - everything runs locally, nothing is uploaded anywhere.

The main problem it solves: a lot of SVG icons have extra padding or inconsistent positioning baked into the file. iconify trims the empty space around each icon before rendering, so the resulting PNG is tight and correctly centered regardless of what the source SVG looked like.

## Usage

Open `index.html` in a browser locally (or just use the hosted version at https://luca1197.github.io/fork-iconify/). Select one or more `.svg` files, adjust your settings, then hit **Iconify!**

- A single file with no manifest → downloads directly as a `.png`
- Multiple files, or any run with a manifest → downloads as `iconify.zip`

## Options

### Color

Pick **Unchanged** to keep the SVG's original colors, or choose **Black**, **White**, or **Custom** to override them. The recoloring applies to all filled shapes in the SVG.

### Width / Height

Set the output dimensions in pixels. If you leave **Height** blank, it falls back to the same value as **Width**. Leave both blank to keep the original SVG size.

### Output name

A template for the output filename (without the `.png` extension). The following placeholders are available:

| Placeholder | Description |
|-------------|-------------|
| `{name}` | Original filename without extension |
| `{width}` | Output width in pixels |
| `{height}` | Output height in pixels |
| `{size}` | Width and height combined, e.g. `64x64` |
| `{color}` | Color name or hex value, e.g. `white`, `ff0000` |

Defaults to `{name}` for single-size runs, and `{name}_{width}x{height}` for multi-size runs. You can use `/` in the template to create subfolders inside the ZIP (e.g. `{size}/{name}`).

### Multiple Sizes

Tick **Multiple Sizes** to export the same icons at several resolutions in one go. Add sizes manually with **+ Add**, or use the quick-add buttons (16, 32, 64, 128, 256) for common square sizes.

By default the result is packaged as a ZIP. Untick **Download as ZIP** to download each file individually instead.

### Presets

You can save the current form state as a named preset. Type a name in the preset field and click **Save**. To restore a preset, select it from the dropdown and click **Load**. Custom presets can be deleted with the **Delete** button. Presets are saved locally in your browser's localStorage.

Several built-in presets are included for common cases: black and white icons at 16×16, 32×32, 64×64, and 128×128.

### Manifest

Tick **With Manifest** to include a manifest file in the ZIP. The manifest entry for each icon contains its bounding box within the output image - `left`, `top`, `width`, `height` - which is useful when you need precise positioning data, for example when drawing icons in a game.

Tick **Extended Manifest** to also include the full canvas dimensions and the color value alongside the bounding box.

The **Format** dropdown lets you choose between **JSON** and **Lua Table** output.
