# 📄 Guía de Paginación para Frontend - Manejo de Miles de Páginas

## 🎯 Problema

Cuando hay **miles o cientos de miles de páginas**, mostrar todos los números de página no es práctico ni eficiente. Esta guía proporciona estrategias y ejemplos de código para manejar esto correctamente.

---

## 📊 Formato de Respuesta del Backend

El backend devuelve la siguiente estructura:

```typescript
{
  data: T[], // Array de resultados
  meta: {
    total: number;        // Total de registros (ej: 150,000)
    page: number;         // Página actual (ej: 1)
    pageSize: number;     // Tamaño de página (ej: 15)
    totalPages: number;   // Total de páginas (ej: 10,000)
  }
}
```

---

## ✅ Estrategias Recomendadas

### 1. **Paginación Inteligente con Elipsis** ⭐ (Recomendado)

Mostrar solo las páginas cercanas a la actual, con elipsis para indicar páginas ocultas.

**Ejemplo visual:**
```
[Primera] ... [48] [49] [50] [51] [52] ... [Última]
```

**Ventajas:**
- ✅ Interfaz limpia y manejable
- ✅ Permite navegar hacia adelante/atrás fácilmente
- ✅ Muestra contexto de dónde estás
- ✅ Funciona con cualquier cantidad de páginas

---

### 2. **Input para Saltar a Página Específica**

Permitir al usuario escribir directamente el número de página.

**Ejemplo visual:**
```
Ir a página: [____] [Ir]
```

**Ventajas:**
- ✅ Útil para usuarios que saben exactamente qué página buscan
- ✅ Permite saltar grandes distancias rápidamente

---

### 3. **Límites y Validaciones**

- Limitar el número máximo de páginas navegables
- Validar que la página solicitada existe
- Mostrar mensajes claros cuando se alcanzan los límites

---

## 💻 Ejemplos de Implementación

### React + TypeScript

#### Componente de Paginación Inteligente

```typescript
import React, { useState, useEffect } from 'react';

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number; // Páginas visibles a cada lado de la actual
}

export const SmartPagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  maxVisiblePages = 2,
}) => {
  const { page, totalPages } = meta;
  const [jumpToPage, setJumpToPage] = useState<string>('');

  // Calcular qué páginas mostrar
  const getVisiblePages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const showFirst = page > maxVisiblePages + 2;
    const showLast = page < totalPages - maxVisiblePages - 1;

    // Primera página
    if (showFirst) {
      pages.push(1);
      if (page > maxVisiblePages + 3) {
        pages.push('ellipsis-start');
      }
    }

    // Páginas alrededor de la actual
    const start = Math.max(1, page - maxVisiblePages);
    const end = Math.min(totalPages, page + maxVisiblePages);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Última página
    if (showLast) {
      if (page < totalPages - maxVisiblePages - 2) {
        pages.push('ellipsis-end');
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpToPage('');
    }
  };

  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages();

  return (
    <div className="pagination-container">
      {/* Información */}
      <div className="pagination-info">
        Mostrando página {page} de {totalPages} ({meta.total} registros totales)
      </div>

      {/* Controles de navegación */}
      <div className="pagination-controls">
        {/* Botón Primera */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="pagination-btn"
        >
          « Primera
        </button>

        {/* Botón Anterior */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="pagination-btn"
        >
          ‹ Anterior
        </button>

        {/* Páginas visibles */}
        {visiblePages.map((pageNum, index) => {
          if (pageNum === 'ellipsis-start' || pageNum === 'ellipsis-end') {
            return (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                ...
              </span>
            );
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`pagination-btn ${
                page === pageNum ? 'active' : ''
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Botón Siguiente */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="pagination-btn"
        >
          Siguiente ›
        </button>

        {/* Botón Última */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="pagination-btn"
        >
          Última »
        </button>
      </div>

      {/* Input para saltar a página */}
      <div className="pagination-jump">
        <label>Ir a página:</label>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={jumpToPage}
          onChange={(e) => setJumpToPage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleJumpToPage();
            }
          }}
          placeholder={`1-${totalPages}`}
          className="pagination-jump-input"
        />
        <button
          onClick={handleJumpToPage}
          disabled={!jumpToPage}
          className="pagination-btn"
        >
          Ir
        </button>
      </div>
    </div>
  );
};
```

#### Estilos CSS

```css
.pagination-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.pagination-info {
  font-size: 0.9rem;
  color: #6c757d;
}

.pagination-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  background: white;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  min-width: 40px;
}

.pagination-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #adb5bd;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
  font-weight: bold;
}

.pagination-ellipsis {
  padding: 0.5rem;
  color: #6c757d;
  font-weight: bold;
}

.pagination-jump {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.pagination-jump label {
  font-size: 0.9rem;
  color: #495057;
}

.pagination-jump-input {
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  width: 80px;
  text-align: center;
}

.pagination-jump-input:focus {
  outline: none;
  border-color: #007bff;
}
```

#### Uso del Componente

```typescript
import React, { useState, useEffect } from 'react';
import { SmartPagination } from './SmartPagination';

const ReservasList: React.FC = () => {
  const [reservas, setReservas] = useState([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  const fetchReservas = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reservas?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      setReservas(data.data);
      setMeta(data.meta);
    } catch (error) {
      console.error('Error fetching reservas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservas(1);
  }, []);

  const handlePageChange = (newPage: number) => {
    fetchReservas(newPage);
    // Opcional: Scroll al inicio de la lista
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {loading && <div>Cargando...</div>}
      
      {/* Lista de reservas */}
      <div className="reservas-list">
        {reservas.map((reserva) => (
          <ReservaCard key={reserva._id} reserva={reserva} />
        ))}
      </div>

      {/* Paginación */}
      <SmartPagination
        meta={meta}
        onPageChange={handlePageChange}
        maxVisiblePages={2}
      />
    </div>
  );
};
```

---

### Vue 3 + TypeScript

```vue
<template>
  <div class="pagination-container">
    <!-- Información -->
    <div class="pagination-info">
      Mostrando página {{ meta.page }} de {{ meta.totalPages }}
      ({{ meta.total }} registros totales)
    </div>

    <!-- Controles -->
    <div class="pagination-controls">
      <button
        @click="goToPage(1)"
        :disabled="meta.page === 1"
        class="pagination-btn"
      >
        « Primera
      </button>
      <button
        @click="goToPage(meta.page - 1)"
        :disabled="meta.page === 1"
        class="pagination-btn"
      >
        ‹ Anterior
      </button>

      <template v-for="(pageNum, index) in visiblePages" :key="index">
        <span
          v-if="pageNum === 'ellipsis'"
          class="pagination-ellipsis"
        >
          ...
        </span>
        <button
          v-else
          @click="goToPage(pageNum)"
          :class="['pagination-btn', { active: meta.page === pageNum }]"
        >
          {{ pageNum }}
        </button>
      </template>

      <button
        @click="goToPage(meta.page + 1)"
        :disabled="meta.page === meta.totalPages"
        class="pagination-btn"
      >
        Siguiente ›
      </button>
      <button
        @click="goToPage(meta.totalPages)"
        :disabled="meta.page === meta.totalPages"
        class="pagination-btn"
      >
        Última »
      </button>
    </div>

    <!-- Saltar a página -->
    <div class="pagination-jump">
      <label>Ir a página:</label>
      <input
        v-model.number="jumpToPage"
        type="number"
        :min="1"
        :max="meta.totalPages"
        @keyup.enter="handleJump"
        class="pagination-jump-input"
      />
      <button @click="handleJump" class="pagination-btn">Ir</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const props = defineProps<{
  meta: PaginationMeta;
}>();

const emit = defineEmits<{
  (e: 'page-change', page: number): void;
}>();

const jumpToPage = ref<number | null>(null);
const maxVisiblePages = 2;

const visiblePages = computed(() => {
  const { page, totalPages } = props.meta;
  const pages: (number | string)[] = [];
  const showFirst = page > maxVisiblePages + 2;
  const showLast = page < totalPages - maxVisiblePages - 1;

  if (showFirst) {
    pages.push(1);
    if (page > maxVisiblePages + 3) {
      pages.push('ellipsis');
    }
  }

  const start = Math.max(1, page - maxVisiblePages);
  const end = Math.min(totalPages, page + maxVisiblePages);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (showLast) {
    if (page < totalPages - maxVisiblePages - 2) {
      pages.push('ellipsis');
    }
    pages.push(totalPages);
  }

  return pages;
});

const goToPage = (page: number) => {
  if (page >= 1 && page <= props.meta.totalPages) {
    emit('page-change', page);
  }
};

const handleJump = () => {
  if (jumpToPage.value) {
    goToPage(jumpToPage.value);
    jumpToPage.value = null;
  }
};
</script>
```

---

## 🎨 Mejores Prácticas

### 1. **Límite de Páginas Visibles**

```typescript
// Si hay más de 10,000 páginas, mostrar advertencia
if (meta.totalPages > 10000) {
  // Mostrar mensaje: "Hay muchas páginas. Usa búsqueda o filtros para reducir resultados."
}
```

### 2. **Validación en el Backend**

El backend ya valida que la página sea válida, pero puedes agregar validación adicional:

```typescript
const handlePageChange = (newPage: number) => {
  if (newPage < 1 || newPage > meta.totalPages) {
    console.warn('Página inválida');
    return;
  }
  fetchReservas(newPage);
};
```

### 3. **Loading States**

Siempre muestra un estado de carga mientras se obtienen los datos:

```typescript
const [loading, setLoading] = useState(false);

const fetchReservas = async (page: number) => {
  setLoading(true);
  try {
    // ... fetch data
  } finally {
    setLoading(false);
  }
};
```

### 4. **Scroll al Inicio**

Cuando cambias de página, haz scroll al inicio de la lista:

```typescript
const handlePageChange = (newPage: number) => {
  fetchReservas(newPage);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
```

### 5. **Búsqueda y Filtros**

**IMPORTANTE:** Para reducir el número de páginas, implementa búsqueda y filtros:

```typescript
// En lugar de mostrar 10,000 páginas de todas las reservas
// Permite buscar por:
// - Nombre de huésped
// - Estado de reserva
// - Fecha de check-in
// - Agencia
// etc.

const handleSearch = async (searchTerm: string) => {
  const response = await fetch(
    `/api/reservas/buscar/huesped?nombre=${searchTerm}&page=1`
  );
  // Esto reducirá drásticamente el número de resultados
};
```

---

## 🚀 Alternativa: Infinite Scroll

Para listas muy largas, considera **infinite scroll** en lugar de paginación tradicional:

```typescript
const [allReservas, setAllReservas] = useState([]);
const [hasMore, setHasMore] = useState(true);
const [currentPage, setCurrentPage] = useState(1);

const loadMore = async () => {
  const response = await fetch(`/api/reservas?page=${currentPage + 1}`);
  const data = await response.json();
  
  setAllReservas([...allReservas, ...data.data]);
  setCurrentPage(currentPage + 1);
  setHasMore(data.meta.page < data.meta.totalPages);
};

// Usar con Intersection Observer
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore) {
      loadMore();
    }
  });

  const sentinel = document.getElementById('load-more-sentinel');
  if (sentinel) observer.observe(sentinel);

  return () => observer.disconnect();
}, [hasMore]);
```

---

## 📝 Resumen

1. ✅ **Usa paginación inteligente con elipsis** para miles de páginas
2. ✅ **Implementa input para saltar a página específica**
3. ✅ **Valida que la página existe antes de hacer la petición**
4. ✅ **Muestra estados de carga**
5. ✅ **Haz scroll al inicio al cambiar de página**
6. ✅ **Implementa búsqueda y filtros** para reducir resultados
7. ✅ **Considera infinite scroll** para listas muy largas

---

## 🔗 Recursos Adicionales

- [React Pagination Libraries](https://www.npmjs.com/package/react-paginate)
- [Vue Pagination Components](https://github.com/gilbarbara/vue-pagination-2)
- [Angular Material Paginator](https://material.angular.io/components/paginator)
