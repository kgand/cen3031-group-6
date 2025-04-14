import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
import time
import json
import logging
import os
import re
from typing import List, Dict, Optional
from functools import wraps
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Set up logging with a more efficient configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class ZoomTranscriptScraper:
    def __init__(self, headless: bool = True):
        """Initialize the scraper with optimized options."""
        self.headless = headless
        self.driver = None
        self.setup_driver()
    
    def setup_driver(self):
        """Set up Chrome driver with optimized performance settings."""
        try:
            options = uc.ChromeOptions()
            options.add_argument("--headless=new") if self.headless else None
            options.add_argument("--disable-gpu")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-extensions")
            options.add_argument("--disable-logging")
            options.add_argument("--disable-notifications")
            options.add_argument("--disable-default-apps")
            options.add_argument("--disable-popup-blocking")
            options.add_argument("--disable-web-security")
            options.add_argument("--disable-translate")
            options.add_argument("--disable-client-side-phishing-detection")
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--window-size=1280,720')
            options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            
            # Performance optimizations
            prefs = {
                'profile.default_content_setting_values': {
                    'images': 2,  # Disable images
                    'notifications': 2,  # Disable notifications
                    'geolocation': 2  # Disable location
                },
                'disk-cache-size': 4096,
                'javascript.enabled': True
            }
            options.add_experimental_option('prefs', prefs)
            
            self.driver = uc.Chrome(options=options)
            self.driver.set_script_timeout(10)
            self.driver.set_page_load_timeout(30)
            logger.info("Chrome driver setup successful")
        except Exception as e:
            logger.error(f"Failed to setup Chrome driver: {str(e)}")
            raise

    def wait_for_element(self, by: By, value: str, timeout: int = 5) -> Optional[object]:
        """Optimized element wait with shorter timeout."""
        try:
            return WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
        except (TimeoutException, Exception):
            return None

    def wait_for_elements(self, by: By, value: str, timeout: int = 5) -> List[object]:
        """Optimized elements wait with shorter timeout."""
        try:
            return WebDriverWait(self.driver, timeout).until(
                EC.presence_of_all_elements_located((by, value))
            )
        except (TimeoutException, Exception):
            return []

    def extract_time_from_aria_label(self, aria_label: str) -> int:
        """Optimized time extraction with regex patterns."""
        try:
            parts = aria_label.split(',')
            if len(parts) < 3:
                return 0
                
            time_part = parts[2].strip().lower()
            if not any(word in time_part for word in ['hour', 'minute', 'second']):
                return 0

            patterns = [
                (r'(\d+)\s*hour', 3600),
                (r'(\d+)\s*minute', 60),
                (r'(\d+)\s*second', 1)
            ]
            
            return sum(int(match.group(1)) * multiplier 
                      for pattern, multiplier in patterns 
                      if (match := re.search(pattern, time_part)))
        except Exception:
            return 0

    def format_timestamp(self, seconds: int) -> str:
        """Fast timestamp formatting."""
        return f"{seconds//60:02d}:{seconds%60:02d}"

    def clean_and_format_transcript(self, items: List[object]) -> List[Dict]:
        """Optimized transcript cleaning with parallel processing."""
        def process_item(item) -> Optional[Dict]:
            try:
                aria_label = item.get_attribute("aria-label")
                if not aria_label:
                    return None

                parts = aria_label.split(',', 3)
                if len(parts) < 4:
                    return None

                text = parts[3].strip()
                if not text or text.lower() in {"view all", "audio transcript", "highlighted"}:
                    return None

                return {
                    "timestamp_seconds": self.extract_time_from_aria_label(parts[2]),
                    "text": re.sub(r'\s+', ' ', text).strip()
                }
            except Exception:
                return None

        # Process items in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(filter(None, executor.map(process_item, items)))

        # Sort and assign final timestamps
        results.sort(key=lambda x: x["timestamp_seconds"])
        
        # Ensure chronological order
        last_time = 0
        cleaned_data = []
        seen_texts = set()
        
        for item in results:
            text_key = item["text"].lower()
            if text_key in seen_texts:
                continue
                
            timestamp = max(last_time + 1, item["timestamp_seconds"]) if item["timestamp_seconds"] == 0 else item["timestamp_seconds"]
            last_time = timestamp
            
            seen_texts.add(text_key)
            cleaned_data.append({
                "timestamp_seconds": timestamp,
                "timestamp": self.format_timestamp(timestamp),
                "text": item["text"]
            })

        return cleaned_data

    def format_for_llm(self, data: List[Dict]) -> str:
        """Fast transcript formatting."""
        if not data:
            return "No transcript data available."

        current_minute = -1
        lines = []
        
        for entry in data:
            minute = entry['timestamp_seconds'] // 60
            if minute != current_minute:
                current_minute = minute
                lines.extend(["", f"[Minute {minute}]", ""])
            lines.append(f"[{entry['timestamp']}] {entry['text']}")

        return "\n".join(lines).strip()

    def scrape_transcript(self, url: str) -> Dict:
        """Optimized transcript scraping that returns data instead of saving to files."""
        try:
            self.driver.get(url)
            
            # Fast transcript detection
            selectors = [
                ".transcript-list-item",
                "[aria-label*='transcript' i]",
                "[class*='transcript-button']",
                "button:has-text('Transcript')"
            ]

            items = None
            for selector in selectors:
                try:
                    if 'button' in selector or 'transcript' in selector:
                        button = self.wait_for_element(By.CSS_SELECTOR, selector)
                        if button and button.is_displayed():
                            button.click()
                            time.sleep(0.5)
                    
                    items = self.wait_for_elements(By.CSS_SELECTOR, ".transcript-list-item")
                    if items:
                        break
                except Exception:
                    continue

            if not items:
                return {
                    "success": False,
                    "error": "No transcript items found",
                    "transcript_data": []
                }

            # Process transcript
            transcript_data = self.clean_and_format_transcript(items)
            if not transcript_data:
                return {
                    "success": False,
                    "error": "No valid transcript content",
                    "transcript_data": []
                }

            formatted_text = self.format_for_llm(transcript_data)
            
            logger.info(f"Processed {len(transcript_data)} segments")
            
            return {
                "success": True,
                "transcript_data": transcript_data,
                "formatted_text": formatted_text,
                "segment_count": len(transcript_data)
            }
            
        except Exception as e:
            logger.error(f"Scraping failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "transcript_data": []
            }
        finally:
            self.cleanup()

    def cleanup(self):
        """Fast cleanup."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            finally:
                self.driver = None

def scrape_zoom_transcript(url: str, headless: bool = True) -> Dict:
    """
    Utility function to scrape a Zoom recording transcript
    
    Args:
        url: The Zoom recording URL
        headless: Whether to run the browser in headless mode
        
    Returns:
        Dict containing success status, transcript data and formatted text
    """
    scraper = None
    try:
        scraper = ZoomTranscriptScraper(headless=headless)
        result = scraper.scrape_transcript(url)
        return result
    except Exception as e:
        logger.error(f"Error scraping transcript: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "transcript_data": []
        }
    finally:
        if scraper:
            scraper.cleanup() 