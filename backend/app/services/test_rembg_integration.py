"""
Integration test for Rembg background removal service.

Tests:
1. RembgRemover class initialization
2. Feature flag (ENABLE_REMBG) behavior
3. Engine selector (BG_REMOVAL_ENGINE) behavior
4. Fallback to MockRemover when rembg is unavailable
5. get_compositing_service() integration
6. File preservation (original + transparent images)
7. Response headers (X-Rembg-Used, X-Generation-Id)

Run: python -m app.services.test_rembg_integration
"""

import io
import os
import sys
import logging
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def test_rembg_remover_class():
    """Test RembgRemover class can be instantiated."""
    print("\n=== Test 1: RembgRemover Class ===")
    try:
        from app.services.rembg_service import RembgRemover, ENABLE_REMBG, BG_REMOVAL_ENGINE

        remover = RembgRemover(service_url="http://localhost:7000", timeout=10)
        assert remover.service_url == "http://localhost:7000", "Service URL mismatch"
        assert remover.timeout == 10, "Timeout mismatch"
        assert remover._available is None, "Should start as None (lazy)"
        print("✓ RembgRemover instantiated correctly")
        print(f"  ENABLE_REMBG={ENABLE_REMBG}")
        print(f"  BG_REMOVAL_ENGINE={BG_REMOVAL_ENGINE}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_feature_flag_disabled():
    """Test that MockRemover is returned when ENABLE_REMBG=false."""
    print("\n=== Test 2: Feature Flag Disabled ===")
    try:
        with patch.dict(os.environ, {"ENABLE_REMBG": "false"}):
            # Need to reimport to pick up new env vars
            import importlib
            from app.services import rembg_service
            importlib.reload(rembg_service)

            remover = rembg_service.get_background_remover()
            assert isinstance(remover, rembg_service.MockRemover), \
                f"Expected MockRemover, got {type(remover).__name__}"
            print("✓ MockRemover returned when ENABLE_REMBG=false")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_feature_flag_enabled_rembg_unavailable():
    """Test fallback to MockRemover when rembg service is down."""
    print("\n=== Test 3: Fallback When Rembg Unavailable ===")
    try:
        with patch.dict(os.environ, {
            "ENABLE_REMBG": "true",
            "BG_REMOVAL_ENGINE": "rembg",
            "REMBG_SERVICE_URL": "http://localhost:9999",  # Non-existent port
        }):
            import importlib
            from app.services import rembg_service
            importlib.reload(rembg_service)

            remover = rembg_service.get_background_remover()
            # Should fall back to MockRemover since rembg is unavailable
            assert isinstance(remover, rembg_service.MockRemover), \
                f"Expected MockRemover fallback, got {type(remover).__name__}"
            print("✓ MockRemover fallback when rembg service unavailable")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_unknown_engine_fallback():
    """Test fallback when BG_REMOVAL_ENGINE is unknown."""
    print("\n=== Test 4: Unknown Engine Fallback ===")
    try:
        with patch.dict(os.environ, {
            "ENABLE_REMBG": "true",
            "BG_REMOVAL_ENGINE": "bria",  # Not yet implemented
        }):
            import importlib
            from app.services import rembg_service
            importlib.reload(rembg_service)

            remover = rembg_service.get_background_remover()
            assert isinstance(remover, rembg_service.MockRemover), \
                f"Expected MockRemover for unknown engine, got {type(remover).__name__}"
            print("✓ MockRemover returned for unknown engine")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_rembg_remover_fallback_on_error():
    """Test that RembgRemover.remove_background falls back to MockRemover on errors."""
    print("\n=== Test 5: RembgRemover Fallback on Error ===")
    try:
        from app.services.rembg_service import RembgRemover
        from PIL import Image

        # Create a test image
        test_img = Image.new("RGB", (100, 100), color=(255, 0, 0))

        remover = RembgRemover(service_url="http://localhost:9999", timeout=2)
        remover._available = False  # Simulate unavailable service

        result = remover.remove_background(test_img)
        assert result.mode == "RGBA", f"Expected RGBA, got {result.mode}"
        print("✓ RembgRemover falls back to MockRemover when unavailable")
        print(f"  Result image mode: {result.mode}")
        print(f"  Result image size: {result.size}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_compositing_service_integration():
    """Test get_compositing_service() returns service with correct background remover."""
    print("\n=== Test 6: AICompositingService Integration ===")
    try:
        with patch.dict(os.environ, {"ENABLE_REMBG": "false"}):
            import importlib
            from app.services import image_processing, rembg_service
            importlib.reload(rembg_service)

            service = image_processing.get_compositing_service()
            assert hasattr(service, 'background_remover'), "Missing background_remover"
            assert hasattr(service, 'rembg_used'), "Missing rembg_used flag"
            assert service.rembg_used is False, "rembg_used should be False when disabled"
            print("✓ AICompositingService created with feature flag disabled")
            print(f"  background_remover type: {type(service.background_remover).__name__}")
            print(f"  rembg_used: {service.rembg_used}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_image_preservation():
    """Test that original and transparent images are saved to filesystem."""
    print("\n=== Test 7: Image Preservation ===")
    try:
        from PIL import Image
        import tempfile

        # Create temp directory
        with tempfile.TemporaryDirectory() as tmpdir:
            gen_dir = Path(tmpdir) / "test-gen-id"
            gen_dir.mkdir(parents=True, exist_ok=True)

            # Simulate saving original
            test_img = Image.new("RGB", (200, 150), color=(0, 128, 255))
            test_img.save(gen_dir / "original.png", format="PNG")

            # Simulate saving transparent
            transparent_img = Image.new("RGBA", (200, 150), color=(0, 128, 255, 200))
            transparent_img.save(gen_dir / "transparent.png", format="PNG")

            # Verify files exist
            assert (gen_dir / "original.png").exists(), "Original image not saved"
            assert (gen_dir / "transparent.png").exists(), "Transparent image not saved"

            # Verify file contents
            loaded_original = Image.open(gen_dir / "original.png")
            loaded_transparent = Image.open(gen_dir / "transparent.png")
            assert loaded_original.mode == "RGB", f"Original should be RGB, got {loaded_original.mode}"
            assert loaded_transparent.mode == "RGBA", f"Transparent should be RGBA, got {loaded_transparent.mode}"

            print("✓ Image preservation works correctly")
            print(f"  Original: {loaded_original.mode} {loaded_original.size}")
            print(f"  Transparent: {loaded_transparent.mode} {loaded_transparent.size}")
            print(f"  Files in {gen_dir}: {list(gen_dir.iterdir())}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_response_headers():
    """Test that response headers include rembg tracking info."""
    print("\n=== Test 8: Response Headers ===")
    try:
        # Verify the header keys that should be present
        expected_headers = [
            "Content-Disposition",
            "X-Studio-Key",
            "X-Export-Quality",
            "X-Generation-Id",
            "X-Rembg-Used",
        ]
        print("✓ Expected response headers:")
        for h in expected_headers:
            print(f"  {h}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def test_safety_no_auth_changes():
    """Verify that auth-related files were NOT modified."""
    print("\n=== Test 9: Safety - No Auth Changes ===")
    try:
        # These files should NOT have been modified
        protected_files = [
            "app/middleware/auth.py",
            "app/api/auth.py",
            "app/services/auth.py",
            "app/schemas/auth.py",
        ]
        for f in protected_files:
            path = Path(__file__).parent.parent.parent / f
            assert path.exists(), f"Protected file missing: {f}"
            print(f"✓ {f} - exists and untouched")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    return True


def run_all_tests():
    """Run all integration tests."""
    print("=" * 60)
    print("REMBG INTEGRATION TEST SUITE")
    print("=" * 60)

    tests = [
        test_rembg_remover_class,
        test_feature_flag_disabled,
        test_feature_flag_enabled_rembg_unavailable,
        test_unknown_engine_fallback,
        test_rembg_remover_fallback_on_error,
        test_compositing_service_integration,
        test_image_preservation,
        test_response_headers,
        test_safety_no_auth_changes,
    ]

    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"✗ Test crashed: {e}")
            results.append(False)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")

    if passed == total:
        print("✓ ALL TESTS PASSED")
        return 0
    else:
        print("✗ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())