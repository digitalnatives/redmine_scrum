class TeRemainingHours < ActiveRecord::Migration
  def change 
    add_column :time_entries, :te_remaining_hours, :float, :after => :hours
  end
end
