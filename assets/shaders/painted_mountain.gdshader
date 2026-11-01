shader_type spatial;
#include "res://assets/shaders/render_color.gdshaderinc"
render_mode cull_disabled;
#include "res://assets/shaders/painted_rock.gdshaderinc"
varying vec3 world;
void vertex() { world=(MODEL_MATRIX*vec4(VERTEX,1)).xyz; }
void fragment() {
 vec3 n=normalize((INV_VIEW_MATRIX*vec4(NORMAL,0)).xyz);
 ALBEDO=painted_rock(world,n,COLOR.rgb);
 ROUGHNESS=.96;
 SPECULAR=.08;

 ALBEDO=rally_output_color(ALBEDO);
}
