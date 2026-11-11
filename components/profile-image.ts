import { isProfileAvatar } from "@/src/core";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const AVATAR_EDGE = 256;

function rasterMime(bytes: Uint8Array): string | null {
	if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return "image/png";
	if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
	if (
		String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
		String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
	)
		return "image/webp";
	return null;
}

export async function prepareProfileImage(file: File): Promise<string> {
	if (!file.size || file.size > MAX_UPLOAD_BYTES)
		throw new Error("Choose a PNG, JPEG or WebP image up to 8 MB.");
	const bytes = new Uint8Array(await file.arrayBuffer());
	const mime = rasterMime(bytes);
	if (!mime || mime !== file.type)
		throw new Error("Choose a PNG, JPEG or WebP image. SVG files aren’t supported.");
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
	} catch {
		throw new Error("This image could not be opened. Choose another image.");
	}
	try {
		const canvas = document.createElement("canvas");
		const scale = Math.min(1, AVATAR_EDGE / Math.max(bitmap.width, bitmap.height));
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Image processing is unavailable. Try another browser.");
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const avatar = canvas.toDataURL("image/png");
		if (!isProfileAvatar(avatar)) throw new Error("This image could not be prepared. Choose another image.");
		return avatar;
	} finally {
		bitmap.close();
	}
}
