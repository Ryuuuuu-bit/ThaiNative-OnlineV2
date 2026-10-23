"""Regression: a larger atlas cell must never disguise a clipped source pose."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('packer', Path(__file__).with_name('pack-shadow-eight.py'))
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)

class SourceBoundaryTest(unittest.TestCase):
    def test_every_frame_and_each_edge(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'sheet.png'
            size=packer.SOURCE_CELL
            source = Image.new('RGBA', (size*4,size*4))
            for i in range(16):
                source.paste((255,255,255,255), (i%4*size+64,i//4*size+32,i%4*size+192,i//4*size+240))
            source.save(path)
            self.assertEqual(len(packer.frames_of(path)),16)
            for i in range(16):
                for x,y in [(0,128),(128,0),(size-1,128),(128,size-1)]:
                    bad=source.copy()
                    bad.putpixel((i%4*size+x,i//4*size+y),(255,255,255,255))
                    bad.save(path)
                    with self.assertRaises(AssertionError):
                        packer.frames_of(path)
            source.paste((0,0,0,0),(0,0,size,size))
            source.save(path)
            with self.assertRaises(AssertionError):
                packer.frames_of(path)

if __name__=='__main__': unittest.main()
