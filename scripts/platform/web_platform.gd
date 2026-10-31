extends Node

# Keep the callback alive for the lifetime of the browser runtime.
var visibility_callback: JavaScriptObject
var was_muted: bool = false
var backgrounded: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if not OS.has_feature("web"): return
	visibility_callback = JavaScriptBridge.create_callback(_visibility_changed)
	JavaScriptBridge.get_interface("window").brushlineVisibility = visibility_callback

func _visibility_changed(arguments: Array) -> void:
	var hidden := bool(arguments[0])
	if hidden == backgrounded: return
	backgrounded = hidden
	if hidden:
		was_muted = AudioServer.is_bus_mute(0)
		AudioServer.set_bus_mute(0,true)
		var app := get_tree().current_scene
		if app == null: return
		var demo: Node = app.get("showcase")
		if is_instance_valid(demo): demo.set_playing(false)
		var race: Node = app.get("race")
		if is_instance_valid(race) and race.has_method("_safety_pause"):
			race.call("_safety_pause")
			race.set("startup_focus_pause",false)
	else:
		AudioServer.set_bus_mute(0,was_muted)
	# Driving/demo stays paused until the player explicitly continues.
