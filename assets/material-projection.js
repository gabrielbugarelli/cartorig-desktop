/* Geographic transform for repeating editorial map materials.
 * A single texture tile spans exactly 90° of longitude. Four repeats cover
 * 360° so the seam stays aligned when the camera wraps at ±180°.
 * Source images are reused and never filtered/recreated during camera motion.
 * The matrix maps image pixel coordinates to canvas scene coordinates.
 */
export const MATERIAL_TILE_LONGITUDE_DEGREES=90;
export function materialPatternTransform({w,h,k,center_lon=0,center_lat=0,bearing=0,imageWidth}){
 if(![w,h,k,center_lon,center_lat,bearing,imageWidth].every(Number.isFinite)||!(w>0&&h>0&&k>0&&imageWidth>0))throw Error('Invalid geographic material transform');
 const theta=bearing*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta);
 const pixelDegrees=MATERIAL_TILE_LONGITUDE_DEGREES/imageWidth;
 const a=k*pixelDegrees*cos,b=k*pixelDegrees*sin,c=-k*pixelDegrees*sin,d=k*pixelDegrees*cos;
 // Texture origin is (-180°, +90°), and its Y axis runs south, just
 // like the image raster and the geographic map projection.
 const dx=(-180-center_lon)*k,dy=(center_lat-90)*k;
 const e=w/2+dx*cos-dy*sin,f=h/2+dx*sin+dy*cos;
 return {a,b,c,d,e,f};
}
