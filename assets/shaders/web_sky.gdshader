shader_type sky;

#include "res://assets/shaders/autumn_sky_palette.gdshaderinc"
#include "res://assets/shaders/anime_clouds.gdshaderinc"
uniform bool painted_banks = false;
uniform vec3 sun_direction = vec3(-0.6, 0.4, -0.6);

// Compatibility has no half-resolution sky subpass. Paint the same atlas
// directly in the background pass; radiance keeps the broad sky palette.
void sky() {
    float alignment = max(dot(EYEDIR, normalize(sun_direction)), 0.0);
    COLOR = autumn_sky(EYEDIR, sun_direction);
    COLOR += vec3(2.5, 1.8, 0.8) * smoothstep(cos(0.009), cos(0.0065), alignment);
    if (painted_banks && !AT_CUBEMAP_PASS && EYEDIR.y > 0.035 && EYEDIR.y < 0.7) {
        vec4 cloud = painted_clouds(EYEDIR, sun_direction);
        COLOR = mix(COLOR, cloud.rgb, cloud.a);
    }
    COLOR = mix(vec3(0.24, 0.18, 0.29), COLOR, smoothstep(-0.12, 0.01, EYEDIR.y));
}
