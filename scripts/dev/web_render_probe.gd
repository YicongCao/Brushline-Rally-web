extends SceneTree
# Fixed camera/reference captures; uses isolated showcase profiles.
# Run with --rendering-method forward_plus or gl_compatibility.
func _initialize() -> void: run.call_deferred()
func run() -> void:
 var renderer:=RenderingServer.get_current_rendering_method()
 var label:=renderer
 var dest:="res://logs/web-render-reference/"
 DirAccess.make_dir_recursive_absolute(dest)
 AudioServer.set_bus_mute(0,true)
 for stage: String in RallyContentCatalog.STAGES:
  var world:=RallyShowcaseWorld.new()
  await world.prepare(root,stage,"F160",func(_v: float,_t: String): pass)
  world.viewport.size=Vector2i(1920,1080)
  world.viewport.msaa_3d=Viewport.MSAA_2X
  world.viewport.screen_space_aa=Viewport.SCREEN_SPACE_AA_DISABLED
  world.viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
  var scene: Node3D=world.scene
  var route: RallyStageRoute=scene.generator.route
  var station:=430.0
  var pose:=route.pose_at(station)
  scene.vehicle.transform=pose
  scene.vehicle.show()
  scene.camera.position=pose.origin+pose.basis.z*9+Vector3.UP*4
  scene.camera.look_at(pose.origin-pose.basis.z*8+Vector3.UP)
  scene.camera.make_current()
  for i in range(45): await process_frame
  await RenderingServer.frame_post_draw
  world.viewport.get_texture().get_image().save_png(dest+label+"-"+stage+".png")
  print("PROBE ",label," ",stage," ",world.viewport.size)
  world.viewport.queue_free()
  await process_frame
 quit()
