import { defs, tiny } from './common.js';
// Pull these names into this module's scope for convenience:
const { vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene, hex_color } = tiny;

const { Textured_Phong } = defs


export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
    // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}

export class MyScene extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
    // Detailed model files can be used in place of simpler primitive-based
    // shapes to add complexity to a scene.  Simpler primitives in your scene
    // can just be thought of as placeholders until you find a model file
    // that fits well.  This demo shows the teapot model twice, with one
    // teapot showing off the Fake_Bump_Map effect while the other has a
    // regular texture and Phong lighting.
    constructor() {
        super();
        // Load the model file:
        this.shapes = { "teapot": new Shape_From_File("assets/teapot.obj") };

        // Don't create any DOM elements to control this scene:
        this.widget_options = { make_controls: false };
        // Non bump mapped:
        this.heightLerp = new Material(new Texture_Lerp(), {
            color: hex_color("#ffffff"),
            ambient: .5, diffusivity: 0.1, specularity: 0.1,
            texture: new Texture("assets/BrickColor.png"),
            texture2: new Texture("assets/GrassColor.png"),
            texture3: new Texture("assets/BrickDisplacement.png")
        });
        // Bump mapped:
        this.bumps = new Material(new Bump_Map(), {
            color: color(1, 1, 1, 1),
            ambient: 0.1, diffusivity: 0.5, specularity: 0.5, texture: new Texture("assets/GrassColor.png")
        });
    }




    display(context, program_state) {
        // const t = program_state.animation_time;
        const t = 1;
        program_state.set_camera(Mat4.translation(0, 0, -5));    // Locate the camera here (inverted matrix).
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        // A spinning light to show off the bump map:
        program_state.lights = [new Light(
            Mat4.rotation(0, 1, 0, 0).times(vec4(3, 2, 10, 1)),
            color(1, .7, .7, 1), 100000)];



        // Spin the 3D model shapes as well.
        const model_transform = Mat4.rotation(t / 2000, 0, 2, 1)
            .times(Mat4.translation(0, 0, 0))
            .times(Mat4.rotation(t / 1500, -1, 2, 0))
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0));
        this.shapes.teapot.draw(context, program_state, model_transform, this.heightLerp);

    }

    show_explanation(document_element) {
        document_element.innerHTML += "<p>This demo loads an external 3D model file of a teapot.  It uses a condensed version of the \"webgl-obj-loader.js\" "
            + "open source library, though this version is not guaranteed to be complete and may not handle some .OBJ files.  It is contained in the class \"Shape_From_File\". "
            + "</p><p>One of these teapots is lit with bump mapping.  Can you tell which one?</p>";
    }
}

class Texture_Lerp extends Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);

        context.uniform1i(gpu_addresses.texture2, 0);
        context.uniform1i(gpu_addresses.texture, 1);
        context.uniform1i(gpu_addresses.texture3, 2);
        material.texture2.activate(context, 0);
        material.texture.activate(context, 1);
        material.texture3.activate(context, 2);
    }


    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform sampler2D texture2;
            uniform sampler2D texture3;

            void main(){

                vec4 tex_color = texture2D( texture, f_tex_coord);
                vec4 tex2_color = texture2D( texture2, f_tex_coord );
                vec4 dispMap = texture2D(texture3, f_tex_coord);
                
                // TODO IMPLEMENT VAL BUTTON SIN WAVE
                float val = 0.5;
                // -------------------------
                
                val = clamp( val, 0.0, 1.0 );
                val = 1.0 - val; // inverting
                val *= 2.0; 
                
                dispMap = dispMap - 1.0;
                dispMap = dispMap + val;

                dispMap = clamp(dispMap,0.0,1.0);
                
                gl_FragColor = mix(tex2_color, tex_color, dispMap );
                gl_FragColor = dispMap;
               
                //gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}


class Bump_Map extends Textured_Phong {
    // **Fake_Bump_Map** Same as Phong_Shader, except adds a line of code to
    // compute a new normal vector, perturbed according to texture color.
    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
                uniform sampler2D normalMap;
        
                void main(){
                    // Sample the texture image in the correct place:
                    vec4 tex_color = texture2D( normalMap, f_tex_coord );
                    // if( tex_color.w < .01 ) discard;
                    // Slightly disturb normals based on sampling the same image that was used for texturing:
                    vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
                    // Compute an initial (ambient) color:
                    gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                    // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
                  } `;
    }

}

class Old_Bump extends Textured_Phong {
    // **Fake_Bump_Map** Same as Phong_Shader, except adds a line of code to
    // compute a new normal vector, perturbed according to texture color.
    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
        
                void main(){
                    // Sample the texture image in the correct place:
                    vec4 tex_color = texture2D( texture, f_tex_coord );
                    if( tex_color.w < .01 ) discard;
                    // Slightly disturb normals based on sampling the same image that was used for texturing:
                    vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
                    // Compute an initial (ambient) color:
                    gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                    // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
                  } `;
    }
}