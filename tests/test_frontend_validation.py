#!/usr/bin/env python3
"""
Frontend validation test suite
Validates HTML, CSS, and JavaScript files for syntax and structure
"""

import os
import sys
import subprocess
import re
from pathlib import Path

def test_html_files():
    """Test HTML files for basic structure"""
    print("📄 Testing HTML files...")
    
    html_files = list(Path('.').glob('*.html'))
    if not html_files:
        print("❌ No HTML files found")
        return False
    
    passed = 0
    for html_file in html_files:
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for required HTML structure
            required_tags = ['<html', '<head', '<body']
            missing_tags = [tag for tag in required_tags if tag not in content.lower()]
            
            if not missing_tags:
                print(f"✅ {html_file.name} - Basic HTML structure valid")
                passed += 1
            else:
                print(f"❌ {html_file.name} - Missing tags: {missing_tags}")
                
        except Exception as e:
            print(f"❌ {html_file.name} - Error reading file: {e}")
    
    print(f"   HTML files: {passed}/{len(html_files)} passed")
    return passed == len(html_files)

def test_javascript_files():
    """Test JavaScript files for syntax"""
    print("\n📜 Testing JavaScript files...")
    
    js_files = list(Path('.').glob('*.js'))
    if not js_files:
        print("❌ No JavaScript files found")
        return False
    
    passed = 0
    for js_file in js_files:
        try:
            # Try to use node for syntax checking if available
            if subprocess.run(['which', 'node'], capture_output=True).returncode == 0:
                result = subprocess.run(['node', '-c', str(js_file)], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    print(f"✅ {js_file.name} - JavaScript syntax valid")
                    passed += 1
                else:
                    print(f"❌ {js_file.name} - Syntax errors: {result.stderr.strip()}")
            else:
                # Basic syntax check without node
                with open(js_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check for basic JavaScript structure
                if '{' in content and '}' in content:
                    print(f"⚠️  {js_file.name} - Basic structure check (node not available)")
                    passed += 1
                else:
                    print(f"❌ {js_file.name} - No JavaScript structure found")
                    
        except Exception as e:
            print(f"❌ {js_file.name} - Error: {e}")
    
    print(f"   JavaScript files: {passed}/{len(js_files)} passed")
    return passed == len(js_files)

def test_css_files():
    """Test CSS files for basic structure"""
    print("\n🎨 Testing CSS files...")
    
    css_files = list(Path('.').glob('*.css'))
    if not css_files:
        print("❌ No CSS files found")
        return False
    
    passed = 0
    for css_file in css_files:
        try:
            with open(css_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for basic CSS structure
            if '{' in content and '}' in content:
                # Count braces to check for balance
                open_braces = content.count('{')
                close_braces = content.count('}')
                
                if open_braces == close_braces:
                    print(f"✅ {css_file.name} - CSS structure valid")
                    passed += 1
                else:
                    print(f"❌ {css_file.name} - Unbalanced braces ({open_braces} open, {close_braces} close)")
            else:
                print(f"❌ {css_file.name} - No CSS structure found")
                
        except Exception as e:
            print(f"❌ {css_file.name} - Error: {e}")
    
    print(f"   CSS files: {passed}/{len(css_files)} passed")
    return passed == len(css_files)

def test_http_server():
    """Test if frontend files are ready for serving"""
    print("\n🌐 Testing frontend files for serving...")
    
    try:
        # Check if main files exist and are readable
        required_files = ['index.html', 'script.js', 'styles.css']
        missing_files = []
        
        for file in required_files:
            if not Path(file).exists():
                missing_files.append(file)
            elif not Path(file).is_file():
                missing_files.append(f"{file} (not a file)")
        
        if missing_files:
            print(f"❌ Frontend files - Missing: {missing_files}")
            return False
        
        # Check if files are readable
        for file in required_files:
            try:
                with open(file, 'r') as f:
                    f.read(100)  # Read first 100 chars to test readability
            except Exception as e:
                print(f"❌ Frontend files - Cannot read {file}: {e}")
                return False
        
        print("✅ Frontend files - All required files present and readable")
        return True
        
    except Exception as e:
        print(f"❌ Frontend files - Error: {e}")
        return False

def run_all_tests():
    """Run all frontend validation tests"""
    print("🧪 MTG NLP Search - Frontend Validation Test Suite")
    print("=" * 60)
    
    # Change to frontend directory
    frontend_dir = Path(__file__).parent.parent
    os.chdir(frontend_dir)
    
    tests = [
        ("HTML Structure", test_html_files),
        ("JavaScript Syntax", test_javascript_files),
        ("CSS Structure", test_css_files),
        ("Frontend Files", test_http_server)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 {test_name}")
        print("-" * 30)
        if test_func():
            passed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 FRONTEND VALIDATION TESTS: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 ALL FRONTEND VALIDATION TESTS PASSED!")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
