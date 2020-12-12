import {defs, tiny} from './common.js';
// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

const Minimal_Webgl_Demo = defs.Minimal_Webgl_Demo;

//******THIS FILE WAS USED FOR DEVELOPMENT AND TESTING ONLY. NOT PART OF FINAL SCENE.*******

export class Plane extends Scene {
    constructor() {
        super();
        // Load the model file:
        this.shapes = {
            plane2: new defs.Square()
        };
        this.shapes.plane2.arrays.texture_coord.forEach(v => v.scale_by(2));

        this.materials = {
            plane: new Material(new defs.Phong_Shader(),
                {ambient: .3, diffusity: .5, color: color(1,1,1,1)}),
            stars: new Material(new defs.Textured_Phong(1), {
                //color: color(.5, .5, .5, 1),
                ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture("assets/stars.png")}),
            bump: new Material(new defs.Bump(),
                {ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture("assets/stars.png")}),

            brick: new Material(new defs.Textured_Phong(), {
                ambient: .3, diffusivity: .7, texture: new Texture("assets/BrickColor.png")}),

            bumpBrick: new Material(new defs.Bump(),
                {ambient: .3, diffusivity: .7, texture: new Texture("assets/BrickColor.png"), texture2: new Texture("assets/BrickNormal.png")}),

            grass: new Material(new defs.Textured_Phong(1), {
                ambient: .3, diffusivity: .7, texture: new Texture("assets/GrassColor.png")}),

            bumpGrass: new Material(new defs.Bump(),
                {ambient: .3, diffusivity: .7, texture: new Texture("assets/GrassColor.png")}),
        };

        // Don't create any DOM elements to control this scene:
        //this.widget_options = {make_controls: false};

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        //this.key_triggered_button("", ["c"], );
        //this.key_triggered_button("", ["o"], () => {
        //});
        this.key_triggered_button("Pause", ["c"], () => {}
            ,"#87cefa" );
        this.new_line();
        this.key_triggered_button("-", ["a"], () => {}
        ,"#0000ff" );
        this.live_string(box => {
            box.textContent = "|    Time:    |"
        }, );
        this.key_triggered_button("+", ["b"], () => {}
            ,"#0000ff" );
    }

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:

        let camera_matrix_plane = Mat4.identity().times(Mat4.translation(0,0,-5.0));
        let model_transform_plane = Mat4.identity();
        //LIGHTING
        const light_position_plane = vec4(0, 0, 10, 1);
        program_state.lights = [new Light(light_position_plane, color(1, 1, 1, 1), 100)];

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(camera_matrix_plane);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        model_transform_plane = model_transform_plane.times(Mat4.translation(-0.5,0,0));
        this.shapes.plane2.draw(context, program_state, model_transform_plane, this.materials.bumpBrick);

        model_transform_plane = model_transform_plane.times(Mat4.translation(2,0,0));
        this.shapes.plane2.draw(context,program_state, model_transform_plane, this.materials.brick);
    }
}