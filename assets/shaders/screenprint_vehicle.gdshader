shader_type spatial;
#include "res://assets/shaders/render_color.gdshaderinc"
render_mode cull_disabled, specular_disabled;
uniform vec4 paint : source_color = vec4(0.2,0.4,0.4,1.0);
uniform vec3 shadow_ink : source_color = vec3(0.27,0.24,0.34);
uniform vec3 shade_steps=vec3(.30,.63,1.0);
uniform float glass = 0.0;
uniform bool vehicle_lighting = false;
uniform vec3 sky_fill = vec3(0.0);
varying vec3 local_position;
void vertex(){local_position=VERTEX;}
void fragment(){
 ALBEDO=rally_source_linear(paint.rgb);
 ROUGHNESS=.86;
 // One broad painted reflection, anchored to the glass rather than the screen.
 float reflection=smoothstep(.17,.21,local_position.x+local_position.y*.75)*
 (1.0-smoothstep(.32,.36,local_position.x+local_position.y*.75));
 ALBEDO=mix(ALBEDO,mix(ALBEDO,vec3(.44,.57,.61),.42),reflection*glass);

 // A restrained sky fill keeps painted body panels legible in WebGL shadows.
 // Geometry still receives the directional bands and cast shadows.
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
 EMISSION=rally_output_color(ALBEDO * sky_fill);
#endif
 ALBEDO=rally_output_color(ALBEDO);
}
void light(){
 float n=dot(NORMAL,LIGHT);
 float bands=shade_steps.x+(shade_steps.y-shade_steps.x)*smoothstep(.02,.09,n)+(shade_steps.z-shade_steps.y)*smoothstep(.58,.65,n);
 vec3 shade=mix(rally_source_linear(shadow_ink),vec3(1.0),bands);
 // Godot multiplies accumulated diffuse by ALBEDO after light().
 DIFFUSE_LIGHT+=(vehicle_lighting ? vec3(1.0) : ALBEDO)*shade*LIGHT_COLOR*ATTENUATION/PI;
}
