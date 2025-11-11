import {
  CATEGORIES,
  getCategoryBySlug,
  isValidCategory,
  VALID_CATEGORY_SLUGS,
  Category
} from '../categories'

describe('Category Configuration', () => {
  describe('CATEGORIES constant', () => {
    it('should contain exactly 9 categories', () => {
      expect(CATEGORIES).toHaveLength(9)
    })

    it('should have all required categories', () => {
      const expectedSlugs = ['新車', '評測', '電動車', '產業', '市場', '科技', '政策', '安全', '賽車']
      const actualSlugs = CATEGORIES.map(cat => cat.slug)

      expectedSlugs.forEach(slug => {
        expect(actualSlugs).toContain(slug)
      })
    })

    it('should have unique slugs', () => {
      const slugs = CATEGORIES.map(cat => cat.slug)
      const uniqueSlugs = [...new Set(slugs)]

      expect(slugs).toHaveLength(uniqueSlugs.length)
    })

    it('should have all required fields for each category', () => {
      CATEGORIES.forEach(category => {
        expect(category).toHaveProperty('slug')
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('description')

        expect(typeof category.slug).toBe('string')
        expect(typeof category.name).toBe('string')
        expect(typeof category.description).toBe('string')

        expect(category.slug.length).toBeGreaterThan(0)
        expect(category.name.length).toBeGreaterThan(0)
        expect(category.description.length).toBeGreaterThan(0)
      })
    })

    it('should not contain legacy "行業" category', () => {
      const slugs = CATEGORIES.map(cat => cat.slug)
      expect(slugs).not.toContain('行業')
    })

    it('should use correct category for business news', () => {
      const slugs = CATEGORIES.map(cat => cat.slug)
      expect(slugs).toContain('產業')
    })
  })

  describe('getCategoryBySlug', () => {
    it('should return category for valid slug', () => {
      const category = getCategoryBySlug('新車')

      expect(category).toBeDefined()
      expect(category?.slug).toBe('新車')
      expect(category?.name).toBe('新車發表')
    })

    it('should return undefined for invalid slug', () => {
      const category = getCategoryBySlug('不存在的分類')

      expect(category).toBeUndefined()
    })

    it('should return undefined for legacy "行業" category', () => {
      const category = getCategoryBySlug('行業')

      expect(category).toBeUndefined()
    })

    it('should work for all valid categories', () => {
      const expectedCategories = [
        { slug: '新車', name: '新車發表' },
        { slug: '評測', name: '試駕評測' },
        { slug: '電動車', name: '電動車' },
        { slug: '產業', name: '產業動態' },
        { slug: '市場', name: '市場趨勢' },
        { slug: '科技', name: '科技配備' },
        { slug: '政策', name: '政策法規' },
        { slug: '安全', name: '安全召回' },
        { slug: '賽車', name: '賽車運動' }
      ]

      expectedCategories.forEach(({ slug, name }) => {
        const category = getCategoryBySlug(slug)
        expect(category?.slug).toBe(slug)
        expect(category?.name).toBe(name)
      })
    })
  })

  describe('isValidCategory', () => {
    it('should return true for valid categories', () => {
      const validSlugs = ['新車', '評測', '電動車', '產業', '市場', '科技', '政策', '安全', '賽車']

      validSlugs.forEach(slug => {
        expect(isValidCategory(slug)).toBe(true)
      })
    })

    it('should return false for invalid categories', () => {
      const invalidSlugs = ['不存在', '', 'random', '行業', '产业']

      invalidSlugs.forEach(slug => {
        expect(isValidCategory(slug)).toBe(false)
      })
    })

    it('should be case-sensitive', () => {
      expect(isValidCategory('新車')).toBe(true)
      expect(isValidCategory('新车')).toBe(false)
    })
  })

  describe('VALID_CATEGORY_SLUGS', () => {
    it('should contain all category slugs', () => {
      const expectedSlugs = CATEGORIES.map(cat => cat.slug)

      expect(VALID_CATEGORY_SLUGS).toEqual(expectedSlugs)
    })

    it('should have exactly 9 slugs', () => {
      expect(VALID_CATEGORY_SLUGS).toHaveLength(9)
    })
  })

  describe('Category descriptions', () => {
    it('should have clear distinction between 產業 and 市場', () => {
      const industry = getCategoryBySlug('產業')
      const market = getCategoryBySlug('市場')

      expect(industry?.description).toContain('車企')
      expect(market?.description).toContain('市佔')
    })

    it('should have clear distinction between 政策 and 安全', () => {
      const policy = getCategoryBySlug('政策')
      const safety = getCategoryBySlug('安全')

      expect(policy?.description).toContain('法規')
      expect(safety?.description).toContain('召回')
    })
  })

  describe('Backward compatibility', () => {
    it('should maintain existing category URLs', () => {
      // These categories existed before the expansion
      const originalCategories = ['新車', '評測', '電動車', '產業', '科技', '賽車']

      originalCategories.forEach(slug => {
        expect(isValidCategory(slug)).toBe(true)
        expect(getCategoryBySlug(slug)).toBeDefined()
      })
    })

    it('should have new categories added', () => {
      const newCategories = ['市場', '政策', '安全']

      newCategories.forEach(slug => {
        expect(isValidCategory(slug)).toBe(true)
        expect(getCategoryBySlug(slug)).toBeDefined()
      })
    })
  })
})
