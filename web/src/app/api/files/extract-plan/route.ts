import mammoth from "mammoth";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await getAuthedRequest();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "Vui lòng chọn file .docx.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError("VALIDATION_ERROR", "File vượt quá giới hạn 2MB.", 413);
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      throw new ApiError("VALIDATION_ERROR", "Endpoint này chỉ hỗ trợ file .docx.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });

    return ok({
      text: result.value.trim(),
      warnings: result.messages.map((message) => message.message),
    });
  } catch (error) {
    return fail(error);
  }
}

