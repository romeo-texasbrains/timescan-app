/**
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('Adherence Database Functions', () => {
  let mockSupabase;
  
  beforeEach(() => {
    // Reset mocks
    createClient.mockReset();
    
    // Setup mock Supabase client
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
    
    createClient.mockReturnValue(mockSupabase);
  });
  
  describe('calculate_adherence_status function', () => {
    it('calculates early adherence status correctly', async () => {
      // Mock the RPC response for early arrival
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'early',
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { data, error } = await supabase.rpc('calculate_adherence_status', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the function was called with the correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_adherence_status', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the result
      expect(data).toBe('early');
      expect(error).toBeNull();
    });
    
    it('calculates on-time adherence status correctly', async () => {
      // Mock the RPC response for on-time arrival
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'on_time',
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { data, error } = await supabase.rpc('calculate_adherence_status', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the result
      expect(data).toBe('on_time');
      expect(error).toBeNull();
    });
    
    it('calculates late adherence status correctly', async () => {
      // Mock the RPC response for late arrival
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'late',
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { data, error } = await supabase.rpc('calculate_adherence_status', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the result
      expect(data).toBe('late');
      expect(error).toBeNull();
    });
    
    it('calculates absent adherence status correctly', async () => {
      // Mock the RPC response for absent
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'absent',
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { data, error } = await supabase.rpc('calculate_adherence_status', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the result
      expect(data).toBe('absent');
      expect(error).toBeNull();
    });
  });
  
  describe('check_absent_eligibility function', () => {
    it('returns true for eligible employees', async () => {
      // Mock the RPC response for eligible employees
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { data, error } = await supabase.rpc('check_absent_eligibility', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the function was called with the correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_absent_eligibility', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the result
      expect(data).toBe(true);
      expect(error).toBeNull();
    });
    
    it('returns false for non-eligible employees', async () => {
      // Mock the RPC response for non-eligible employees
      mockSupabase.rpc.mockResolvedValueOnce({
        data: false,
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { data, error } = await supabase.rpc('check_absent_eligibility', {
        p_user_id: 'user1',
        p_date: '2023-01-01'
      });
      
      // Verify the result
      expect(data).toBe(false);
      expect(error).toBeNull();
    });
  });
  
  describe('mark_user_absent function', () => {
    it('marks a user as absent', async () => {
      // Mock the RPC response
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });
      
      // Create a Supabase client
      const supabase = createClient('https://example.com', 'fake-key');
      
      // Call the function
      const { error } = await supabase.rpc('mark_user_absent', {
        p_user_id: 'user1',
        p_date: '2023-01-01',
        p_admin_id: 'admin1'
      });
      
      // Verify the function was called with the correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_user_absent', {
        p_user_id: 'user1',
        p_date: '2023-01-01',
        p_admin_id: 'admin1'
      });
      
      // Verify the result
      expect(error).toBeNull();
    });
  });
});
