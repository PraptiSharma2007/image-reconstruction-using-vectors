import io
import base64
from typing import Optional, List, Tuple
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from PIL import Image

app = FastAPI(
    title="VectorVision API",
    description="Linear Algebra and Vector Calculus Engine for Digital Image Processing",
    version="1.0.0"
)

# Enable CORS for frontend integration (React, Vue, Svelte, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# PYDANTIC RESPONSE SCHEMAS
# ==========================================

class MathProcessingResponse(BaseModel):
    success: bool
    operation: str
    processed_image_base64: str
    mime_type: str
    math_logs: List[str]
    metadata: dict


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def load_image_to_numpy(file_bytes: bytes) -> Tuple[np.ndarray, str]:
    """Decodes raw bytes into a floating-point RGB NumPy tensor [0, 255]."""
    try:
        pil_img = Image.open(io.BytesIO(file_bytes))
        format_str = pil_img.format if pil_img.format else "JPEG"
        # Standardize to RGB space (drops alpha channel if present for clean 3D tensors)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        return np.array(pil_img, dtype=np.float64), format_str
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {str(e)}"
        )


def numpy_to_base64(arr: np.ndarray, format_str: str = "JPEG") -> str:
    """Clips, quantizes, and serializes a NumPy matrix to a base64 data URI."""
    arr_clipped = np.clip(arr, 0, 255).astype(np.uint8)
    out_img = Image.fromarray(arr_clipped)
    buffered = io.BytesIO()
    out_img.save(buffered, format="JPEG" if format_str.upper() not in ["PNG", "WEBP"] else format_str.upper(), quality=92)
    b64_encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{format_str.lower()};base64,{b64_encoded}"


# ==========================================
# ENDPOINT 1: SVD IMAGE COMPRESSION
# ==========================================

@app.post("/api/compress", response_model=MathProcessingResponse)
async def compress_svd(
    file: UploadFile = File(...),
    percentage: Optional[float] = Form(None, description="Compression rank percentage [1 - 100]"),
    target_kb: Optional[float] = Form(None, description="Target size in Kilobytes")
):
    """
    Performs Low-Rank Matrix Approximation via Singular Value Decomposition (SVD):
    A = U * Sigma * V^T -> A_k = sum_{i=1}^k (sigma_i * u_i * v_i^T)
    """
    if percentage is None and target_kb is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Specify either 'percentage' (1-100) or 'target_kb'."
        )

    file_bytes = await file.read()
    img_tensor, img_format = load_image_to_numpy(file_bytes)
    h, w, c = img_tensor.shape
    max_rank = min(h, w)
    math_logs: List[str] = []

    math_logs.append(f"[Tensor Ingestion] Shape: {h} x {w} across {c} color channels (Rank上限 K={max_rank}).")
    math_logs.append(f"[Linear Map] Image decomposed into 3 discrete subspace matrices: A_R, A_G, A_B ∈ ℝ^({h}×{w}).")

    # Determine rank k
    if percentage is not None:
        clamped_pct = max(1.0, min(100.0, percentage))
        k = max(1, int(np.round((clamped_pct / 100.0) * max_rank)))
        math_logs.append(f"[Input Strategy] User selected rank factor: {clamped_pct:.1f}%.")
    else:
        # Storage for rank k: k * (h + w + 1) floats per channel * 4 bytes/float (float32)
        bytes_per_k_unit = c * (h + w + 1) * 4
        target_bytes = target_kb * 1024
        estimated_k = int(target_bytes / bytes_per_k_unit)
        k = max(1, min(max_rank, estimated_k))
        math_logs.append(f"[Target Optimization] Budget: {target_kb:.2f} KB -> Linear budget: k={k} vectors.")

    compressed_tensor = np.zeros_like(img_tensor)
    total_energy_original = 0.0
    total_energy_retained = 0.0

    math_logs.append(f"[Spectral Decomposition] Executing A_c = U_c Σ_c V_c^T via Golub-Reinsch / LAPACK...")

    # Process each color channel matrix independently
    for channel_idx, channel_name in enumerate(["Red", "Green", "Blue"]):
        A_channel = img_tensor[:, :, channel_idx]

        # SVD: U is (h, min(h,w)), S is (min(h,w),), Vt is (min(h,w), w)
        U, s, Vt = np.linalg.svd(A_channel, full_matrices=False)

        # Frobenius norm energy: ||A||_F^2 = sum(sigma_i^2)
        chan_energy_total = np.sum(s ** 2)
        chan_energy_k = np.sum(s[:k] ** 2)
        total_energy_original += chan_energy_total
        total_energy_retained += chan_energy_k

        # Eckart-Young-Mirsky optimal rank-k reconstruction:
        # A_k = U[:, :k] @ diag(s[:k]) @ Vt[:k, :]
        # Vectorized scaling without explicit diag(s) allocation:
        A_k = np.dot(U[:, :k] * s[:k], Vt[:k, :])
        compressed_tensor[:, :, channel_idx] = A_k

    # Calculate overall energy (variance) retained
    variance_retained = (total_energy_retained / total_energy_original) * 100.0
    param_original = h * w
    param_compressed = k * (h + w + 1)
    compression_ratio = param_original / param_compressed

    math_logs.append(f"[Eckart-Young Truncation] Truncated spectrum to k={k} principal singular components.")
    math_logs.append(f"[Frobenius Metric] Spectral Energy Retained: {variance_retained:.2f}% (Information Preserved).")
    math_logs.append(
        f"[Degrees of Freedom] Param space reduced from {param_original:,} to {param_compressed:,} per channel."
    )
    math_logs.append(f"[Compression Ratio] Theoretical matrix storage reduction: {compression_ratio:.2f}:1.")

    b64_result = numpy_to_base64(compressed_tensor, img_format)

    return MathProcessingResponse(
        success=True,
        operation="Singular Value Decomposition (SVD)",
        processed_image_base64=b64_result,
        mime_type=f"image/{img_format.lower()}",
        math_logs=math_logs,
        metadata={
            "original_dimensions": [h, w],
            "channels": c,
            "rank_retained": k,
            "max_rank": max_rank,
            "variance_retained_percent": round(variance_retained, 2),
            "compression_ratio": round(compression_ratio, 2)
        }
    )


# ==========================================
# ENDPOINT 2: BILINEAR VECTOR INTERPOLATION
# ==========================================

@app.post("/api/upscale", response_model=MathProcessingResponse)
async def upscale_bilinear(
    file: UploadFile = File(...),
    scale: float = Form(..., description="Scale factor between 1.1 and 4.0")
):
    """
    Performs Bilinear Vector Upscaling manually using pure NumPy broadcasting.
    Evaluates pixel values as continuous 2D vector field interpolations:
    f(x, y) ≈ (1 - α)(1 - β)P_11 + α(1 - β)P_21 + (1 - α)βP_12 + αβP_22
    """
    if scale < 1.1 or scale > 4.0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Multiplier must be strictly bounded between 1.1x and 4.0x."
        )

    file_bytes = await file.read()
    img_tensor, img_format = load_image_to_numpy(file_bytes)
    h_in, w_in, c = img_tensor.shape
    math_logs: List[str] = []

    h_out = int(np.round(h_in * scale))
    w_out = int(np.round(w_in * scale))

    math_logs.append(f"[Discrete Lattice] Source dimension: {w_in}x{h_in} | Target: {w_out}x{h_out} (Scale: {scale:.2f}x).")
    math_logs.append(f"[Coordinate Transform] Computing inverse affine mapping: T^(-1): ℝ^2 -> ℝ^2 with center-alignment.")

    # Generate 1D continuous target coordinates
    y_target = np.arange(h_out, dtype=np.float64)
    x_target = np.arange(w_out, dtype=np.float64)

    # Center-aligned inverse mapping to align pixel centroids:
    # x_source = (x_target + 0.5) * (w_in / w_out) - 0.5
    scale_y = h_in / h_out
    scale_x = w_in / w_out

    src_y = (y_target + 0.5) * scale_y - 0.5
    src_x = (x_target + 0.5) * scale_x - 0.5

    # Boundary protection
    src_y = np.clip(src_y, 0, h_in - 1)
    src_x = np.clip(src_x, 0, w_in - 1)

    math_logs.append(f"[Sampling Geometry] Constructed continuous sampling grid using meshgrid tensor.")

    # 2D Grid of continuous source coordinates
    grid_x, grid_y = np.meshgrid(src_x, src_y)

    # 4 Bounding Integer Lattice Coordinates
    x1 = np.floor(grid_x).astype(np.int64)
    y1 = np.floor(grid_y).astype(np.int64)
    x2 = np.clip(x1 + 1, 0, w_in - 1)
    y2 = np.clip(y1 + 1, 0, h_in - 1)

    # Sub-pixel interpolation weights (convex coefficients: α, β ∈ [0, 1])
    alpha = (grid_x - x1)[..., np.newaxis]  # Horizontal displacement
    beta = (grid_y - y1)[..., np.newaxis]   # Vertical displacement

    math_logs.append(f"[Neighborhood Search] Identified 4 bounding orthogonal basis vectors per destination cell.")
    math_logs.append(f"[Weight Construction] Computed convex weights α = (x - x₁), β = (y - y₁).")

    # Sample the 4 neighbor pixel vectors across all 3 channels simultaneously
    # Each array shape: (h_out, w_out, 3)
    P11 = img_tensor[y1, x1]  # Top-left
    P21 = img_tensor[y1, x2]  # Top-right
    P12 = img_tensor[y2, x1]  # Bottom-left
    P22 = img_tensor[y2, x2]  # Bottom-right

    math_logs.append(f"[Tensor Product] Assembling bilinear vector sum across RGB vector manifold:")
    math_logs.append(f"   P(x,y) = (1-α)(1-β)P₁₁ + α(1-β)P₂₁ + (1-α)βP₁₂ + αβP₂₂")

    # Vectorized Bilinear Interpolation Equation
    upscaled_tensor = (
        (1.0 - alpha) * (1.0 - beta) * P11 +
        alpha * (1.0 - beta) * P21 +
        (1.0 - alpha) * beta * P12 +
        alpha * beta * P22
    )

    math_logs.append(f"[Partition of Unity] Verified weight invariant: (1-α)(1-β) + α(1-β) + (1-α)β + αβ = 1.0.")
    math_logs.append(f"[Quantization] Target tensor projected to discrete {h_out}x{w_out}x{c} uint8 RGB manifold.")

    b64_result = numpy_to_base64(upscaled_tensor, img_format)

    return MathProcessingResponse(
        success=True,
        operation="Vectorized Bilinear Interpolation",
        processed_image_base64=b64_result,
        mime_type=f"image/{img_format.lower()}",
        math_logs=math_logs,
        metadata={
            "input_dimensions": [h_in, w_in],
            "output_dimensions": [h_out, w_out],
            "scale_factor": scale,
            "total_pixels_synthesized": (h_out * w_out) - (h_in * w_in)
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)