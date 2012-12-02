class TeRemainingHours < ActiveRecord::Migration
  def self.up 
    add_column :time_entries, :te_remaining_hours, :float, :after => :hours
  end
  def self.down 
    remove_column :time_entries, :te_remaining_hours
  end
end
