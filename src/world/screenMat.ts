// Material for surfaces that display an already display-encoded (sRGB) render target, e.g. CCTV monitors.
// Writes the texel straight to the framebuffer: no tone mapping, no second colour-space conversion.
import * as THREE from 'three';

export function makeScreenMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, hasMap: { value: 0 }, gain: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float hasMap; uniform float gain;
      varying vec2 vUv;
      void main() {
        vec3 c = hasMap > 0.5 ? texture2D(map, vUv).rgb : vec3(0.02, 0.025, 0.03);
        gl_FragColor = vec4(c * gain, 1.0);
      }
    `,
    toneMapped: false,
    fog: false,
  });
}

export function setScreenTexture(mat: THREE.ShaderMaterial, tex: THREE.Texture | null): void {
  mat.uniforms.map.value = tex;
  mat.uniforms.hasMap.value = tex ? 1 : 0;
}
