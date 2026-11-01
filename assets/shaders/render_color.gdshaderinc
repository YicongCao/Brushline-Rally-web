#ifndef RALLY_RENDER_COLOR
#define RALLY_RENDER_COLOR
// Forward+ evaluates these authored shaders in linear RGB. Compatibility
// exposes source_color inputs as sRGB and decodes ALBEDO/EMISSION after
// fragment(). Keep all pigment arithmetic linear and bridge only the edges.
vec3 rally_source_linear(vec3 c) {
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
 return mix(c / 12.92, pow((max(c,vec3(0.0)) + .055) / 1.055, vec3(2.4)), greaterThan(c,vec3(.04045)));
#else
 return c;
#endif
}
vec4 rally_source_linear(vec4 c) { return vec4(rally_source_linear(c.rgb),c.a); }
vec3 rally_output_color(vec3 c) {
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
 return mix(c * 12.92, 1.055 * pow(max(c,vec3(0.0)),vec3(1.0/2.4)) - .055, greaterThan(c,vec3(.0031308)));
#else
 return c;
#endif
}
#endif
