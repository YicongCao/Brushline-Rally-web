// Only read configuration from our trusted, manifest-listed Godot export.
export function renderShell(template, exported) {
  const match = exported.match(/const config=(\{[^\n]+\});/);
  const url = exported.match(/<script[^>]*src="([^"<>]+\.js)"/);
  if (!match || !url || !/^[\w.-]+\.js$/.test(url[1])) throw Error('Unsupported Godot export shell');
  const config = JSON.parse(match[1]);
  if (!config.executable || !config.fileSizes) throw Error('Missing Godot configuration');
  return template.replace('$GODOT_CONFIG', () => JSON.stringify(config).replaceAll('<','\\u003c')).replace('$GODOT_URL', () => url[1]);
}
